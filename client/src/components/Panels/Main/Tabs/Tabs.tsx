import { useAtom } from "jotai";
import { useCallback } from "react";
import styled, { css } from "styled-components";
import { Id } from "../../../../constants";

import {
  explorerAtom,
  refreshExplorerAtom,
  showWalletAtom,
} from "../../../../state";
import Button from "../../../Button";
import useCurrentWallet from "../../Wallet/useCurrentWallet";
import Tab from "./Tab";

const Tabs = () => {
  const [explorer] = useAtom(explorerAtom);
  useAtom(refreshExplorerAtom);

  // No need memoization
  const tabs = explorer?.getTabs();

  return (
    <Wrapper id={Id.TABS}>
      <TabsWrapper>
        {tabs?.map((t, i) => (
          <Tab key={i} current={t.current} path={t.path} />
        ))}
      </TabsWrapper>
      <Wallet />
    </Wrapper>
  );
};

const Wallet = () => {
  const [, setShowWallet] = useAtom(showWalletAtom);

  const { walletPkStr } = useCurrentWallet();

  const toggleWallet = useCallback(() => {
    setShowWallet((s) => !s);
  }, [setShowWallet]);

  if (!walletPkStr) return null;

  return (
    <WalletWrapper>
      <Button onClick={toggleWallet} kind="icon">
        <img src="icons/sidebar/wallet.png" alt="Wallet" />
        Wallet
      </Button>
    </WalletWrapper>
  );
};

// Same height with Side-Right Title
export const TAB_HEIGHT = "2rem";

const Wrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: space-between;
    min-height: ${TAB_HEIGHT};
    user-select: none;
    background-color: ${theme.colors.right?.bg};
    border-bottom: 1px solid ${theme.colors.default.borderColor};
    font-size: ${theme.font?.size.small};
  `}
`;

const TabsWrapper = styled.div`
  display: flex;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
`;

const WalletWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;

    & > button {
      background-color: ${theme.colors.default.bg};
      border-top-left-radius: ${theme.borderRadius};
      border-bottom-left-radius: ${theme.borderRadius};
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      font-weight: bold;

      & img {
        filter: invert(0.5);
        margin-right: 0.375rem;
      }

      &:hover img {
        filter: invert(1);
      }
    }
  `}
`;

export default Tabs;
