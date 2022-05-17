import { atom } from "jotai";

import { PgEndpoint } from "../utils/pg/endpoint";
import { PgWallet } from "../utils/pg/wallet";

// Wallet
export const pgWalletAtom = atom(new PgWallet());
export const showWalletAtom = atom(false);
export const balanceAtom = atom<number | null>(null);

// To trigger re-render
const _countAtom = atom(0);
export const refreshPgWalletAtom = atom(
  (get) => get(_countAtom),
  (get, set) => {
    set(_countAtom, get(_countAtom) + 1);
  }
);

// Connection
export const endpointAtom = atom(PgEndpoint.getLsEndpoint());
