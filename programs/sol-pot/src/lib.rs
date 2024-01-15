use anchor_lang::prelude::*;

declare_id!("2osXrDKHFiDhuMA8exFP65qnyg4D2QjV5eNxhWnzXe8z");

#[program]
pub mod sol_pot {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
