import { assert, expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPot } from "../target/types/sol_pot";

use(chaiAsPromised);

describe("SolPot", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const web3 = anchor.web3;
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.SolPot as Program<SolPot>;
  // Dummy wallets for testing.
  const wallets = {
    foo: web3.Keypair.fromSecretKey(
      new Uint8Array([
        182, 220, 84, 131, 54, 38, 202, 150, 131, 0, 149, 17, 76, 92, 177, 131,
        229, 47, 15, 140, 240, 99, 206, 62, 230, 219, 135, 233, 238, 171, 175,
        174, 137, 54, 41, 81, 157, 122, 166, 18, 30, 121, 153, 243, 220, 57,
        244, 167, 130, 240, 110, 152, 248, 224, 250, 75, 159, 219, 189, 169, 76,
        172, 96, 173,
      ])
    ),
    bar: web3.Keypair.fromSecretKey(
      new Uint8Array([
        240, 80, 177, 30, 253, 246, 186, 169, 215, 162, 104, 154, 252, 7, 91,
        255, 103, 123, 72, 43, 189, 55, 45, 233, 205, 96, 202, 160, 84, 14, 138,
        231, 123, 105, 173, 143, 62, 151, 67, 15, 109, 114, 93, 216, 162, 17,
        71, 201, 1, 28, 230, 7, 69, 161, 138, 16, 40, 165, 162, 183, 32, 90,
        108, 192,
      ])
    ),
    baz: web3.Keypair.fromSecretKey(
      new Uint8Array([
        119, 90, 249, 200, 104, 62, 201, 64, 109, 244, 240, 134, 255, 233, 69,
        28, 156, 31, 210, 143, 214, 175, 173, 19, 167, 194, 96, 209, 76, 213,
        64, 147, 223, 244, 39, 173, 77, 68, 243, 164, 236, 123, 121, 29, 46, 32,
        235, 208, 62, 146, 143, 133, 86, 36, 128, 39, 31, 136, 242, 147, 221,
        175, 190, 123,
      ])
    ),
    qux: web3.Keypair.fromSecretKey(
      new Uint8Array([
        194, 9, 89, 209, 226, 132, 241, 194, 186, 93, 165, 4, 127, 106, 47, 5,
        187, 39, 177, 117, 117, 205, 175, 91, 159, 244, 160, 49, 228, 179, 227,
        229, 232, 237, 21, 213, 174, 183, 30, 93, 62, 117, 86, 81, 122, 99, 6,
        119, 254, 176, 52, 214, 202, 183, 172, 121, 8, 6, 241, 194, 43, 78, 21,
        36,
      ])
    ),
    zap: web3.Keypair.fromSecretKey(
      new Uint8Array([
        77, 98, 110, 254, 172, 122, 195, 178, 69, 20, 253, 21, 27, 121, 111, 44,
        33, 180, 116, 153, 99, 208, 8, 203, 57, 147, 18, 217, 22, 112, 18, 9,
        12, 236, 235, 92, 123, 243, 106, 15, 32, 172, 247, 166, 40, 234, 116,
        158, 152, 195, 98, 73, 87, 115, 94, 107, 242, 36, 19, 12, 66, 248, 230,
        251,
      ])
    ),
  };
  // Dummy authority for testing.
  const authority: anchor.web3.Keypair = payer.payer;

  // Accounts used to test the program.
  const [vault] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
  );
  const [lottery] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("lottery"), Buffer.from("Moon")],
    program.programId
  );

  // Log out addresses for debugging.
  console.log("Program ID: ", program.programId.toBase58());
  console.log("Vault: ", vault.toBase58());
  console.log("Lottery: ", lottery.toBase58());
  console.log("Authority: ", authority.publicKey.toBase58());
  for (const [key, value] of Object.entries(wallets)) {
    console.log(`Account (${key}): ${value.publicKey.toBase58()}`);
  }

  const buyTicket = async (wallet: anchor.web3.Keypair) => {
    const programIx = await program.methods
      .buyTicket()
      .accounts({
        buyer: wallet.publicKey,
        lottery,
      })
      .instruction();

    const tx = new web3.Transaction().add(programIx);
    await web3.sendAndConfirmTransaction(provider.connection, tx, [wallet], {
      commitment: "confirmed",
    });

    const lotteryAccount = await program.account.lottery.fetch(lottery);
    const participants = lotteryAccount.participants.map((participant) => {
      return participant.toBase58();
    });

    return participants.includes(wallet.publicKey.toBase58());
  };

  it("Air drop", async () => {
    const lamports = web3.LAMPORTS_PER_SOL;
    const amount = 100 * lamports;
    await Promise.allSettled(
      Object.values(wallets).map(async (wallet) => {
        const balance = await provider.connection.getBalance(wallet.publicKey);
        if (balance > amount) return;
        const topUp = amount - balance;
        return provider.connection.requestAirdrop(wallet.publicKey, topUp);
      })
    );
    assert.ok(true, "Airdrop complete");
  });

  describe("Initialized", () => {
    it("Initialize vault", async () => {
      try {
        const vaultAccount = await program.account.vault.fetch(vault);
        assert.ok(
          vaultAccount.authority.equals(payer.publicKey),
          "Vault is initialized"
        );
      } catch (error) {
        await program.methods
          .initialize(payer.publicKey)
          .accounts({ vault })
          .signers([authority])
          .rpc();
        const vaultAccount = await program.account.vault.fetch(vault);
        assert.ok(
          vaultAccount.authority.equals(payer.publicKey),
          "Vault initialized"
        );
      }
    });
    it("Initialize lottery(Moon)", async () => {
      try {
        const lotteryAccount = await program.account.lottery.fetch(lottery);
        assert.ok(lotteryAccount.name === "Moon", "Lottery is initialized");
      } catch (error) {
        const name = "Moon";
        const ticketPrice = new anchor.BN(web3.LAMPORTS_PER_SOL);
        const maxTickets = new anchor.BN(5);
        const startTimeInSecs = new anchor.BN(0); // now
        const endTimeInSecs = new anchor.BN(1 * 24 * 60 * 60); // 1 day
        const fee = 5;
        const args = [
          name,
          ticketPrice,
          maxTickets,
          startTimeInSecs,
          endTimeInSecs,
          fee,
        ] as const;
        await program.methods
          .createLottery(...args)
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc();
        const lotteryAccount = await program.account.lottery.fetch(lottery);
        assert.ok(lotteryAccount.name === "Moon", "Lottery created");
      }
    });
  });

  describe("Set authority", () => {
    it("Set authority to account(foo)", async () => {
      if (authority.publicKey.equals(wallets.foo.publicKey)) return;

      await program.methods
        .setAuthority(wallets.foo.publicKey)
        .accounts({ vault })
        .signers([authority])
        .rpc();
      const vaultAccount = await program.account.vault.fetch(vault);
      assert.ok(
        vaultAccount.authority.equals(wallets.foo.publicKey),
        "Authority set to account(foo)"
      );
    });

    it("Set authority to account(payer)", async () => {
      await program.methods
        .setAuthority(payer.publicKey)
        .accounts({ authority: wallets.foo.publicKey, vault })
        .signers([wallets.foo])
        .rpc();
      const vaultAccount = await program.account.vault.fetch(vault);
      assert.ok(
        vaultAccount.authority.equals(payer.publicKey),
        "Authority set to account(payer)"
      );
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .setAuthority(wallets.bar.publicKey)
          .accounts({ vault })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Set withdrawer", () => {
    it("Set withdrawer to account(foo)", async () => {
      await program.methods
        .setWithdrawer(wallets.foo.publicKey)
        .accounts({ vault })
        .signers([authority])
        .rpc();
      const vaultAccount = await program.account.vault.fetch(vault);
      assert.ok(
        vaultAccount.withdrawer.equals(wallets.foo.publicKey),
        "Withdrawer set to account(foo)"
      );
    });

    it("Set withdrawer to account(payer)", async () => {
      await program.methods
        .setWithdrawer(payer.publicKey)
        .accounts({ vault })
        .signers([authority])
        .rpc();
      const vaultAccount = await program.account.vault.fetch(vault);
      assert.ok(
        vaultAccount.withdrawer.equals(payer.publicKey),
        "Withdrawer set to account(payer)"
      );
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .setWithdrawer(wallets.bar.publicKey)
          .accounts({ vault })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Withdraw", () => {
    let rent = 1398960;
    let vaultBalance: number;

    before(async () => {
      vaultBalance = (await provider.connection.getBalance(vault)) - rent;
    });

    it("Send 1 SOL to vault if balance is zero", async () => {
      if (vaultBalance > 0) return;
      const tx = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: vault,
          lamports: web3.LAMPORTS_PER_SOL,
        })
      );
      await web3.sendAndConfirmTransaction(provider.connection, tx, [
        authority,
      ]);
      const balance = await provider.connection.getBalance(vault);
      vaultBalance = balance - rent;
      assert.ok(balance >= web3.LAMPORTS_PER_SOL, "Vault funded");
    });

    it("Withdraw SOL from vault", async () => {
      await program.methods
        .withdraw(new anchor.BN(vaultBalance))
        .accounts({ vault })
        .signers([authority])
        .rpc();
      assert.ok(true, "Withdraw complete");
    });

    it("Should fail when amount is zero", async () => {
      await expect(
        program.methods
          .withdraw(new anchor.BN(0))
          .accounts({ vault })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Invalid withdraw amount");
    });

    it("Should fail when amount is greater than balance", async () => {
      await expect(
        program.methods
          .withdraw(new anchor.BN(web3.LAMPORTS_PER_SOL))
          .accounts({ vault })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Insufficient funds");
    });

    it("Should fail to withdraw rent", async () => {
      await expect(
        program.methods
          .withdraw(new anchor.BN(1))
          .accounts({ vault })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Cannot withdraw rent");
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .withdraw(new anchor.BN(1))
          .accounts({ vault })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Set fee", () => {
    let fee: number;

    before(async () => {
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      fee = lotteryAccount.fee;
    });

    it("Set fee to 5%", async () => {
      if (fee === 5) return;
      await program.methods
        .setFee(5)
        .accounts({ vault, lottery })
        .signers([authority])
        .rpc();
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      assert.ok(lotteryAccount.fee === 5, "Fee set to 5%");
    });

    it("Set fee to 10%", async () => {
      await program.methods
        .setFee(10)
        .accounts({ vault, lottery })
        .signers([authority])
        .rpc();
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      assert.ok(lotteryAccount.fee === 10, "Fee set to 10%");
    });

    it("Should fail when fee is equal to current fee", async () => {
      await expect(
        program.methods
          .setFee(10)
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Invalid fee");
    });

    it("Should fail when fee is greater than 100%", async () => {
      await expect(
        program.methods
          .setFee(101)
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Invalid fee");
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .setFee(10)
          .accounts({ vault, lottery })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Set ticket price", () => {
    let ticketPrice: anchor.BN;

    before(async () => {
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      ticketPrice = lotteryAccount.ticketPrice;
    });

    it("Set ticket price to 1 SOL", async () => {
      if (ticketPrice.eq(new anchor.BN(web3.LAMPORTS_PER_SOL))) return;
      await program.methods
        .setTicketPrice(new anchor.BN(web3.LAMPORTS_PER_SOL))
        .accounts({ vault, lottery })
        .signers([authority])
        .rpc();
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      assert.ok(
        lotteryAccount.ticketPrice.eq(new anchor.BN(web3.LAMPORTS_PER_SOL)),
        "Ticket price set to 1 SOL"
      );
    });

    it("Set ticket price to 2 SOL", async () => {
      await program.methods
        .setTicketPrice(new anchor.BN(2 * web3.LAMPORTS_PER_SOL))
        .accounts({ vault, lottery })
        .signers([authority])
        .rpc();
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      assert.ok(
        lotteryAccount.ticketPrice.eq(new anchor.BN(2 * web3.LAMPORTS_PER_SOL)),
        "Ticket price set to 2 SOL"
      );
    });

    it("Should fail when ticket price is zero", async () => {
      await expect(
        program.methods
          .setTicketPrice(new anchor.BN(0))
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Invalid ticket price");
    });

    it("Should fail when ticket price is equal to current ticket price", async () => {
      await expect(
        program.methods
          .setTicketPrice(new anchor.BN(2 * web3.LAMPORTS_PER_SOL))
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Invalid ticket price");
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .setTicketPrice(new anchor.BN(1))
          .accounts({ vault, lottery })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Set time", () => {
    it("Set time to start now and end in 1 day", async () => {
      const startTimeInSecs = new anchor.BN(0); // now
      const endTimeInSecs = new anchor.BN(1 * 24 * 60 * 60); // 1 day
      await program.methods
        .setTime(startTimeInSecs, endTimeInSecs)
        .accounts({ vault, lottery })
        .signers([authority])
        .rpc();
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      assert.ok(
        lotteryAccount.startTime.lte(new anchor.BN(Date.now() / 1000)),
        "Start time set to now"
      );
      assert.ok(
        lotteryAccount.endTime.gte(
          new anchor.BN(Math.floor(Date.now() / 1010))
        ),
        "End time is within 1 day (with 1% tolerance) of now"
      );
    });

    it("Should fail when start time is greater than end time", async () => {
      const startTimeInSecs = new anchor.BN(2 * 24 * 60 * 60); // 2 days
      const endTimeInSecs = new anchor.BN(1 * 24 * 60 * 60); // 1 day
      await expect(
        program.methods
          .setTime(startTimeInSecs, endTimeInSecs)
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Invalid start and end time");
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .setTime(new anchor.BN(0), new anchor.BN(2 * 24 * 60 * 60))
          .accounts({ vault, lottery })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Start lottery", () => {
    it("Account(foo) buy ticket", async () => {
      assert.ok(await buyTicket(wallets.foo), "Account(foo) bought ticket");
    });
  });

  describe("Administration of the lottery once it has commenced", () => {
    it("Should fail when trying to set fee", async () => {
      await expect(
        program.methods
          .setFee(15)
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Lottery already started");
    });

    it("Should fail when trying to set ticket price", async () => {
      await expect(
        program.methods
          .setTicketPrice(new anchor.BN(1))
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Lottery already started");
    });

    it("Should fail when trying to set time", async () => {
      const startTimeInSecs = new anchor.BN(60); // 1 min
      const endTimeInSecs = new anchor.BN(2 * 24 * 60 * 60); // 2 days
      await expect(
        program.methods
          .setTime(startTimeInSecs, endTimeInSecs)
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Lottery already started");
    });

    it("Should fail when trying to end lottery", async () => {
      await expect(
        program.methods
          .endLottery()
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejected;
    });

    it("Should fail when trying to claim prize", async () => {
      await expect(
        program.methods
          .claimPrize()
          .accounts({ vault, lottery })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });

    it("Should fail when trying to reset lottery", async () => {
      const startTimeInSecs = new anchor.BN(0); // now
      const endTimeInSecs = new anchor.BN(1 * 24 * 60 * 60); // 1 day
      await expect(
        program.methods
          .resetLottery(startTimeInSecs, endTimeInSecs)
          .accounts({ vault, lottery, winner: null })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Lottery not ended");
    });
  });

  describe("Buy ticket", () => {
    it("Account(bar) buy ticket", async () => {
      assert.ok(await buyTicket(wallets.bar), "Account(bar) bought ticket");
    });

    it("Account(baz) buy ticket", async () => {
      assert.ok(await buyTicket(wallets.baz), "Account(baz) bought ticket");
    });

    it("Account(qux) buy ticket", async () => {
      assert.ok(await buyTicket(wallets.qux), "Account(qux) bought ticket");
    });

    it("Account(zap) buy ticket", async () => {
      assert.ok(await buyTicket(wallets.zap), "Account(zap) bought ticket");
    });

    it("Should fail when lottery is full", async () => {
      await expect(buyTicket(authority)).to.eventually.rejected;
    });

    it("Should fail when account(foo) buy ticket again", async () => {
      await expect(buyTicket(wallets.foo)).to.eventually.rejected;
    });
  });

  describe("End lottery", () => {
    it("Should fail due to being triggered by the last ticket purchase", async () => {
      await expect(
        program.methods
          .endLottery()
          .accounts({ vault, lottery })
          .signers([authority])
          .rpc()
      ).to.eventually.rejectedWith("Lottery not started");
    });
  });

  describe("Claim prize", () => {
    let winner: anchor.web3.Keypair;

    before(async () => {
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      winner = Object.values(wallets).find((wallet) => {
        return lotteryAccount.winner.equals(wallet.publicKey);
      });
    });

    it("Should fail when signer is not winner", async () => {
      const hacker = Object.values(wallets).find((wallet) => {
        return !wallet.publicKey.equals(winner?.publicKey);
      });
      await expect(
        program.methods
          .claimPrize()
          .accounts({ vault, lottery })
          .signers([hacker])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });

    it("Winner claim prize", async () => {
      if (!winner) return assert.ok(false, "Winner not found");
      await program.methods
        .claimPrize()
        .accounts({ vault, lottery, signer: winner.publicKey })
        .signers([winner])
        .rpc();
      assert.ok(true, "Prize claimed");
    });

    it("Should fail when claiming prize again", async () => {
      await expect(
        program.methods
          .claimPrize()
          .accounts({ vault, lottery })
          .signers([winner])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });

  describe("Reset lottery", () => {
    it("Reset lottery to start now and end in 1 day", async () => {
      const startTimeInSecs = new anchor.BN(0); // now
      const endTimeInSecs = new anchor.BN(1 * 24 * 60 * 60); // 1 day
      await program.methods
        .resetLottery(startTimeInSecs, endTimeInSecs)
        .accounts({ vault, lottery, winner: null })
        .signers([authority])
        .rpc();
      const lotteryAccount = await program.account.lottery.fetch(lottery);
      assert.ok(
        lotteryAccount.startTime.lte(new anchor.BN(Date.now() / 1000)),
        "Start time set to now"
      );
      assert.ok(
        lotteryAccount.endTime.gte(
          new anchor.BN(Math.floor(Date.now() / 1010))
        ),
        "End time is within 1 day (with 1% tolerance) of now"
      );
    });

    it("Should fail when signer is not authority", async () => {
      await expect(
        program.methods
          .resetLottery(
            new anchor.BN(1 * 24 * 60 * 60),
            new anchor.BN(2 * 24 * 60 * 60)
          )
          .accounts({ vault, lottery, winner: null })
          .signers([wallets.foo])
          .rpc()
      ).to.eventually.rejectedWith("unknown signer");
    });
  });
});
