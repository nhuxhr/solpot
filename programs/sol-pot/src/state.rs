use std::ops::Mul;

use crate::errors::*;
use anchor_lang::{prelude::*, solana_program::hash::hash};

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub authority: Pubkey,
    pub withdrawer: Pubkey,
    pub bump: u8,
}

impl Vault {
    pub fn init(&mut self, authority: Pubkey, withdrawer: Pubkey, bump: u8) -> Result<()> {
        self.authority = authority;
        self.withdrawer = withdrawer;
        self.bump = bump;

        Ok(())
    }

    pub fn set_authority(&mut self, authority: Pubkey) -> Result<()> {
        require_keys_neq!(self.authority, authority, SPError::InvalidAuthority);
        self.authority = authority;

        Ok(())
    }

    pub fn set_withdrawer(&mut self, withdrawer: Pubkey) -> Result<()> {
        require_keys_neq!(self.withdrawer, withdrawer, SPError::InvalidWithdrawer);
        self.withdrawer = withdrawer;

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy, Debug)]
pub enum LotteryState {
    NotStarted,
    InProgress,
    Ended,
}

#[account]
pub struct Lottery {
    pub name: String,
    pub participants: Vec<Pubkey>,
    pub winner: Option<Pubkey>,
    pub state: LotteryState,
    pub claimable: bool,
    pub ticket_price: u64,
    pub max_tickets: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub fee: u8,
    pub bump: u8,
}

impl Lottery {
    pub const SIZE_WITHOUT_NAME_AND_PARTICIPANTS: usize = 8 + // Anchor discriminator
        (1 + 32) + // winner
        1 + // state
        1 + // claimable
        8 + // ticket_price
        8 + // max_tickets
        8 + // start_time
        8 + // end_time
        1 + // fee
        1; // bump

    pub fn init(
        &mut self,
        name: String,
        ticket_price: u64,
        max_tickets: u64,
        time: [u64; 2],
        fee: u8,
        bump: u8,
    ) -> Result<()> {
        require!(name.len() <= 32, SPError::InvalidName);
        require!(max_tickets > 0, SPError::InvalidMaxTickets);

        let start_time: u64 = time[0];
        let end_time: u64 = time[1];

        self.name = name;
        self.participants = vec![];
        self.winner = None;
        self.state = LotteryState::NotStarted;
        self.claimable = false;
        self.set_ticket_price(ticket_price)?;
        self.max_tickets = max_tickets;
        self.start_time = 0;
        self.end_time = 0;
        self.set_time(start_time, end_time)?;
        self.set_fee(fee)?;
        self.bump = bump;

        Ok(())
    }

    pub fn set_fee(&mut self, fee: u8) -> Result<()> {
        require!(
            self.state == LotteryState::NotStarted,
            SPError::LotteryAlreadyStarted
        );
        require!(fee <= 100 && self.fee != fee, SPError::InvalidFee);
        self.fee = fee;

        Ok(())
    }

    pub fn set_ticket_price(&mut self, ticket_price: u64) -> Result<()> {
        require!(
            self.state == LotteryState::NotStarted,
            SPError::LotteryAlreadyStarted
        );
        require!(
            ticket_price > 0 && self.ticket_price != ticket_price,
            SPError::InvalidTicketPrice
        );
        self.ticket_price = ticket_price;

        Ok(())
    }

    pub fn set_time(&mut self, start_time: u64, end_time: u64) -> Result<()> {
        let timestamp: i64 = Clock::get()?.unix_timestamp;
        require!(
            self.state != LotteryState::InProgress,
            SPError::LotteryAlreadyStarted
        );
        require!(start_time < end_time, SPError::InvalidStartAndEndTime);

        self.start_time = timestamp + (start_time as i64);
        self.end_time = timestamp + (end_time as i64);
        Ok(())
    }

    pub fn end_lottery(&mut self) -> Result<()> {
        let participants: usize = self.participants.len();
        let max_tickets: usize = self.max_tickets.try_into().unwrap();
        let is_in_progress: bool = self.state == LotteryState::InProgress;
        let is_ended: bool = self.end_time < Clock::get()?.unix_timestamp;
        let is_full: bool = participants.eq(&max_tickets);
        require!(is_in_progress, SPError::LotteryNotStarted);
        require!(is_ended || is_full, SPError::LotteryNotEnded);
        require!(self.winner.is_none(), SPError::LotteryAlreadyEnded);

        let modulus: u64 = participants.try_into().unwrap();
        let index: usize = Self::random_mod(modulus)?.try_into().unwrap();
        self.winner = Some(self.participants[index]);
        self.state = LotteryState::Ended;
        self.claimable = true;

        Ok(())
    }

    pub fn get_prize(&mut self, winner: &AccountInfo<'_>) -> Result<(u64, u64)> {
        let is_winner: bool = self.winner.unwrap() == *winner.key;
        require!(self.claimable, SPError::NotClaimable);
        require!(is_winner, SPError::InvalidAuthority);

        let participants: u64 = self.participants.len().try_into().unwrap();
        let total_lamports: u64 = self.ticket_price.mul(participants);
        let fee: u64 = (total_lamports * (self.fee as u64)) / 100_u64;
        let prize: u64 = total_lamports - fee;

        Ok((prize, fee))
    }

    pub fn random_mod(modulus: u64) -> Result<u64> {
        // Get the current time using Clock::get()
        let clock: Clock = Clock::get()?;

        // Create a hash from the first 8 bytes of the Unix timestamp
        let unix_timestamp_bytes = clock.unix_timestamp.to_be_bytes();
        let hash_bytes: [u8; 8] = hash(&unix_timestamp_bytes).to_bytes()[..8]
            .try_into()
            .unwrap();

        // Convert the hash to a u64
        let hash_as_u64: u64 = u64::from_le_bytes(hash_bytes);

        // Adjust the hash to be within a reasonable range
        let norm_hash_u64: u64 = (hash_as_u64 - (usize::MAX / 100) as u64) / u32::MAX as u64;

        // Multiply the adjusted hash with the clock's slot
        let seed: u32 = (norm_hash_u64 * clock.slot % u32::MAX as u64) as u32;

        // Calculate the final result based on the seed and modulus
        let result: u64 = (seed % modulus as u32) as u64;

        Ok(result)
    }
}
