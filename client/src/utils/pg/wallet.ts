import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

const DEFAULT_LS_WALLET: LsWallet = {
  setupCompleted: false,
  connected: false,
  sk: Array.from(Keypair.generate().secretKey),
};

interface LsWallet {
  setupCompleted: boolean;
  connected: boolean;
  // Uint8Array and Buffer is causing problems while saving to ls
  sk: Array<number>;
}

interface UpdateLsParams {
  setupCompleted?: boolean;
  connected?: boolean;
  sk?: Array<number>;
}

export class PgWallet {
  private _kp: Keypair;
  // Public key will always be set
  publicKey: PublicKey;
  // Connected can change
  connected: boolean;

  constructor() {
    let lsWallet = PgWallet.getLs();
    if (!lsWallet) {
      lsWallet = DEFAULT_LS_WALLET;
      PgWallet.update(DEFAULT_LS_WALLET);
    }

    this._kp = Keypair.fromSecretKey(new Uint8Array(lsWallet.sk));
    this.publicKey = this._kp.publicKey;
    this.connected = lsWallet.connected;
  }

  async signTransaction(tx: Transaction) {
    tx.partialSign(this._kp);
    return tx;
  }

  async signAllTransactions(txs: Transaction[]) {
    for (const tx of txs) {
      tx.partialSign(this._kp);
    }

    return txs;
  }

  // Statics
  private static WALLET_KEY = "wallet";

  static getLs() {
    const lsWalletStr = localStorage.getItem(this.WALLET_KEY);
    if (!lsWalletStr) return null;

    const lsWallet: LsWallet = JSON.parse(lsWalletStr);
    return lsWallet;
  }

  static update(updateParams: UpdateLsParams) {
    const lsWallet = this.getLs() ?? DEFAULT_LS_WALLET;

    if (updateParams.setupCompleted !== undefined)
      lsWallet.setupCompleted = updateParams.setupCompleted;
    if (updateParams.connected !== undefined)
      lsWallet.connected = updateParams.connected;
    if (updateParams.sk) lsWallet.sk = updateParams.sk;

    localStorage.setItem(this.WALLET_KEY, JSON.stringify(lsWallet));
  }

  static getKp() {
    return Keypair.fromSecretKey(new Uint8Array(this.getLs()!.sk));
  }
}
