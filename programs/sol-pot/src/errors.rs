use anchor_lang::prelude::*;

#[error_code]
pub enum SPError {
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid withdrawer")]
    InvalidWithdrawer,
    #[msg("Invalid name")]
    InvalidName,
    #[msg("Invalid max tickets")]
    InvalidMaxTickets,
    #[msg("Invalid ticket price")]
    InvalidTicketPrice,
    #[msg("Invalid start and end time")]
    InvalidStartAndEndTime,
    #[msg("Invalid fee")]
    InvalidFee,
    #[msg("Invalid withdraw amount")]
    InvalidWithdrawAmount,
    #[msg("Invalid winner")]
    InvalidWinner,
    #[msg("Lottery already started")]
    LotteryAlreadyStarted,
    #[msg("Lottery not started")]
    LotteryNotStarted,
    #[msg("Lottery already ended")]
    LotteryAlreadyEnded,
    #[msg("Lottery not ended")]
    LotteryNotEnded,
    #[msg("Lottery full")]
    LotteryFull,
    #[msg("Already participated")]
    AlreadyParticipated,
    #[msg("Lottery ended")]
    LotteryEnded,
    #[msg("Not claimable")]
    NotClaimable,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Cannot withdraw rent")]
    CannotWithdrawRent,
}
