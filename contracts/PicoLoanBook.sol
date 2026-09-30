// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PicoLoanBook
/// @notice Minimal peer-to-peer micro-loan ledger. A lender disburses ETH to a
///         borrower in one transaction; the borrower repays principal + a flat
///         fee, in one or more instalments, directly to the lender.
/// @dev The annualised-rate cap mirrors `validateTerms` in
///      src/core/domain/policy.ts, so the frontend rejects bad terms before
///      a wallet prompt and the contract rejects them regardless.
contract PicoLoanBook {
    uint256 private constant BPS = 10_000;

    struct Loan {
        address lender;
        address borrower;
        uint128 principal;
        uint128 repaid;
        uint16 feeBps;
        uint32 termDays;
        uint64 startedAt;
    }

    /// @notice Maximum annualised rate in basis points (3600 = 36% p.a.).
    uint256 public immutable maxAprBps;
    uint256 public immutable minTermDays;
    uint256 public immutable maxTermDays;

    Loan[] private _loans;
    mapping(address => uint256[]) private _loansOf;
    bool private _locked;

    event LoanOpened(uint256 indexed id, address indexed lender, address indexed borrower, uint256 principal, uint16 feeBps, uint32 termDays);
    event LoanRepaid(uint256 indexed id, address indexed payer, uint256 amount, uint256 outstanding);

    error SelfLoan();
    error ZeroPrincipal();
    error TermOutOfRange();
    error AprAboveCap(uint256 aprBps, uint256 capBps);
    error UnknownLoan();
    error NotBorrower();
    error InvalidAmount();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(uint256 maxAprBps_, uint256 minTermDays_, uint256 maxTermDays_) {
        require(minTermDays_ > 0 && minTermDays_ <= maxTermDays_, "bad term range");
        maxAprBps = maxAprBps_;
        minTermDays = minTermDays_;
        maxTermDays = maxTermDays_;
    }

    /// @notice Disburse `msg.value` to `borrower` as a new loan.
    function open(address borrower, uint16 feeBps, uint32 termDays) external payable nonReentrant returns (uint256 id) {
        if (borrower == msg.sender) revert SelfLoan();
        if (msg.value == 0) revert ZeroPrincipal();
        if (termDays < minTermDays || termDays > maxTermDays) revert TermOutOfRange();
        // ceil(feeBps * 365 / termDays), same rounding as the TS domain.
        uint256 aprBps = (uint256(feeBps) * 365 + termDays - 1) / termDays;
        if (aprBps > maxAprBps) revert AprAboveCap(aprBps, maxAprBps);

        id = _loans.length;
        _loans.push(Loan({
            lender: msg.sender,
            borrower: borrower,
            principal: uint128(msg.value),
            repaid: 0,
            feeBps: feeBps,
            termDays: termDays,
            startedAt: uint64(block.timestamp)
        }));
        _loansOf[msg.sender].push(id);
        _loansOf[borrower].push(id);
        emit LoanOpened(id, msg.sender, borrower, msg.value, feeBps, termDays);

        _send(borrower, msg.value);
    }

    /// @notice Repay part or all of a loan. Overpayment reverts.
    function repay(uint256 id) external payable nonReentrant {
        if (id >= _loans.length) revert UnknownLoan();
        Loan storage loan = _loans[id];
        if (msg.sender != loan.borrower) revert NotBorrower();
        uint256 due = outstanding(id);
        if (msg.value == 0 || msg.value > due) revert InvalidAmount();

        // Effects before interaction (checks-effects-interactions).
        loan.repaid += uint128(msg.value);
        emit LoanRepaid(id, msg.sender, msg.value, due - msg.value);

        _send(loan.lender, msg.value);
    }

    function totalDue(uint256 id) public view returns (uint256) {
        Loan storage loan = _loans[id];
        return loan.principal + (uint256(loan.principal) * loan.feeBps) / BPS;
    }

    function outstanding(uint256 id) public view returns (uint256) {
        uint256 due = totalDue(id);
        uint256 paid = _loans[id].repaid;
        return paid >= due ? 0 : due - paid;
    }

    function getLoan(uint256 id) external view returns (Loan memory) {
        if (id >= _loans.length) revert UnknownLoan();
        return _loans[id];
    }

    function loanCount() external view returns (uint256) {
        return _loans.length;
    }

    function loansOf(address account) external view returns (uint256[] memory) {
        return _loansOf[account];
    }

    function _send(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
