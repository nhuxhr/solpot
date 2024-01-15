use anchor_lang::{prelude::*, system_program};

use account::*;
use errors::*;
use state::*;

pub mod account;
pub mod constants;
pub mod errors;
pub mod state;

#[cfg(not(feature = "no-entrypoint"))]
use {default_env::default_env, solana_security_txt::security_txt};

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "SolPot",
    project_url: "https://solpot.quest",
    contacts: "twitter:nhuxhr,telegram:nhuxhr",
    policy: "https://github.com/nhuxhr/solpot/blob/master/SECURITY.md",
    preferred_languages: "en",
    source_code: "https://github.com/nhuxhr/solpot",
    source_revision: default_env!("GITHUB_SHA", "")
}

declare_id!("2osXrDKHFiDhuMA8exFP65qnyg4D2QjV5eNxhWnzXe8z");

#[program]
pub mod sol_pot {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, withdrawer: Pubkey) -> Result<()> {
        let authority: Pubkey = *ctx.accounts.signer.key;
        let bump: u8 = ctx.bumps.vault;
        ctx.accounts.vault.init(authority, withdrawer, bump)
    }

    pub fn set_authority(ctx: Context<Authority>, authority: Pubkey) -> Result<()> {
        ctx.accounts.vault.set_authority(authority)
    }

    pub fn set_withdrawer(ctx: Context<Authority>, withdrawer: Pubkey) -> Result<()> {
        ctx.accounts.vault.set_withdrawer(withdrawer)
    }

    pub fn withdraw(ctx: Context<WithdrawerAuthority>, amount: u64) -> Result<()> {
        require!(amount > 0, SPError::InvalidWithdrawAmount);

        let rent: u64 = 1398960_u64;
        let balance: u64 = ctx.accounts.vault.get_lamports();
        require!(amount <= balance, SPError::InsufficientFunds);
        require!(balance - amount >= rent, SPError::CannotWithdrawRent);

        let vault: &Account<Vault> = &ctx.accounts.vault;
        let withdrawer: &Signer = &ctx.accounts.withdrawer;

        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **withdrawer.to_account_info().try_borrow_mut_lamports()? += amount;

        Ok(())
    }

    pub fn create_lottery(
        ctx: Context<CreateLottery>,
        name: String,
        ticket_price: u64,
        max_tickets: u64,
        start_time_in_secs: u64,
        end_time_in_secs: u64,
        fee: u8,
    ) -> Result<()> {
        let start_time: u64 = start_time_in_secs;
        let end_time: u64 = end_time_in_secs;
        let bump: u8 = ctx.bumps.lottery;
        ctx.accounts.lottery.init(
            name,
            ticket_price,
            max_tickets,
            [start_time, end_time],
            fee,
            bump,
        )
    }

    pub fn set_fee(ctx: Context<LotteryAuthority>, fee: u8) -> Result<()> {
        ctx.accounts.lottery.set_fee(fee)
    }

    pub fn set_ticket_price(ctx: Context<LotteryAuthority>, ticket_price: u64) -> Result<()> {
        ctx.accounts.lottery.set_ticket_price(ticket_price)
    }

    pub fn set_time(
        ctx: Context<LotteryAuthority>,
        start_time_in_secs: u64,
        end_time_in_secs: u64,
    ) -> Result<()> {
        let start_time: u64 = start_time_in_secs;
        let end_time: u64 = end_time_in_secs;
        ctx.accounts.lottery.set_time(start_time, end_time)
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        let buyer: &Signer = &ctx.accounts.buyer;

        let timestamp: i64 = Clock::get()?.unix_timestamp;
        require!(lottery.start_time <= timestamp, SPError::LotteryNotStarted);

        if lottery.state == LotteryState::NotStarted {
            lottery.state = LotteryState::InProgress;
        }

        require!(
            lottery.state == LotteryState::InProgress && lottery.end_time > timestamp,
            SPError::LotteryEnded
        );

        let max_tickets: usize = lottery.max_tickets.try_into().unwrap();
        require!(
            lottery.participants.len().le(&max_tickets),
            SPError::LotteryFull
        );
        require!(
            !lottery.participants.contains(buyer.key),
            SPError::AlreadyParticipated
        );

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: buyer.to_account_info(),
                    to: lottery.to_account_info(),
                },
            ),
            lottery.ticket_price,
        )?;

        lottery.participants.push(*buyer.key);

        if lottery.participants.len().eq(&max_tickets) {
            lottery.end_lottery()
        } else {
            Ok(())
        }
    }

    pub fn end_lottery(ctx: Context<LotteryAuthority>) -> Result<()> {
        ctx.accounts.lottery.end_lottery()
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let vault: &Account<Vault> = &ctx.accounts.vault;
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        let winner: &Signer = &ctx.accounts.signer;

        let (prize, fee) = lottery.get_prize(&winner.to_account_info())?;
        **lottery.to_account_info().try_borrow_mut_lamports()? -= prize + fee;
        **winner.to_account_info().try_borrow_mut_lamports()? += prize;
        **vault.to_account_info().try_borrow_mut_lamports()? += fee;

        lottery.claimable = false;

        Ok(())
    }

    pub fn reset_lottery(
        ctx: Context<ResetLottery>,
        start_time_in_secs: u64,
        end_time_in_secs: u64,
    ) -> Result<()> {
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;

        if !lottery.participants.is_empty() {
            let is_ended: bool = lottery.state == LotteryState::Ended;
            require!(is_ended, SPError::LotteryNotEnded);
        }

        if lottery.claimable {
            let is_some_winner: bool = lottery.winner.is_some();
            require!(is_some_winner, SPError::InvalidAuthority);
            let vault: &Account<Vault> = &ctx.accounts.vault;
            let winner: &mut SystemAccount<'_> = ctx.accounts.winner.as_mut().unwrap();

            let (prize, fee) = lottery.get_prize(&winner.to_account_info())?;
            **lottery.to_account_info().try_borrow_mut_lamports()? -= prize + fee;
            **winner.to_account_info().try_borrow_mut_lamports()? += prize;
            **vault.to_account_info().try_borrow_mut_lamports()? += fee;

            lottery.claimable = false;
        }

        lottery.participants = vec![];
        lottery.winner = None;
        lottery.state = LotteryState::NotStarted;
        lottery.start_time = 0;
        lottery.end_time = 0;
        lottery.set_time(start_time_in_secs, end_time_in_secs)?;

        Ok(())
    }
}
