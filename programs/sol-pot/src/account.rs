use crate::constants;
use crate::errors::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer = signer,
        space = 8 + Vault::INIT_SPACE,
        seeds = [constants::VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Authority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority @SPError::InvalidAuthority, seeds = [constants::VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct WithdrawerAuthority<'info> {
    #[account(mut)]
    pub withdrawer: Signer<'info>,
    #[account(mut, has_one = withdrawer @SPError::InvalidWithdrawer, seeds = [constants::VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
#[instruction(name: String, ticket_price: u64, max_tickets: u64, start_time_in_secs: u64, end_time_in_secs: u64, fee: u8)]
pub struct CreateLottery<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority @SPError::InvalidAuthority, seeds = [constants::VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        constraint = name.len() <= 32,
        payer = authority,
        space = Lottery::SIZE_WITHOUT_NAME_AND_PARTICIPANTS + // Lottery size without name and participants
            (4 + name.len()) + // Lottery name size
            (4 + (32 * (max_tickets as usize))), // Lottery participants size
        seeds = [constants::LOTTERY_SEED, name.as_bytes()],
        bump
    )]
    pub lottery: Account<'info, Lottery>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LotteryAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority @SPError::InvalidAuthority, seeds = [constants::VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    #[account(mut, seeds = [constants::LOTTERY_SEED, lottery.name.as_bytes()], bump = lottery.bump)]
    pub lottery: Account<'info, Lottery>,
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    pub buyer: Signer<'info>,
    #[account(mut, seeds = [constants::LOTTERY_SEED, lottery.name.as_bytes()], bump = lottery.bump)]
    pub lottery: Account<'info, Lottery>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [constants::VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    #[account(mut, seeds = [constants::LOTTERY_SEED, lottery.name.as_bytes()], bump = lottery.bump)]
    pub lottery: Account<'info, Lottery>,
}

#[derive(Accounts)]
pub struct ResetLottery<'info> {
    pub authority: Signer<'info>,
    #[account(mut, constraint = lottery.winner.is_none() || lottery.winner.unwrap().eq(winner.key) @SPError::InvalidWinner)]
    pub winner: Option<SystemAccount<'info>>,
    #[account(mut, has_one = authority @SPError::InvalidAuthority, seeds = [constants::VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    #[account(mut, seeds = [constants::LOTTERY_SEED, lottery.name.as_bytes()], bump = lottery.bump)]
    pub lottery: Account<'info, Lottery>,
}
