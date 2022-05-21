import { useEffect } from "react";
import styled, { css } from "styled-components";

import Buttons from "./Buttons";
import Folders from "./Folders";
import useExplorerContextMenu from "./useExplorerContextMenu";
import useNewItem from "./useNewItem";

const Explorer = () => {
  const { newItem } = useNewItem();
  const { renameItem, deleteItem } = useExplorerContextMenu();

  // Explorer keybinds
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && e.key === "n") newItem();
      else if (e.key === "F2") renameItem();
      else if (e.key === "Delete") deleteItem();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [newItem, renameItem, deleteItem]);

  return (
    <ExplorerWrapper>
      <Buttons />
      <Folders />
    </ExplorerWrapper>
  );
};

const ExplorerWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    width: 100%;
    user-select: none;

    & .folder,
    & .file {
      display: flex;
      padding: 0.25rem 0;
      cursor: pointer;
      border: 1px solid transparent;

      &.selected {
        background-color: ${theme.colors.default.primary +
        theme.transparency?.low};
      }

      &.ctx-selected {
        background-color: ${theme.colors.default.primary +
        theme.transparency?.medium};
        border-color: ${theme.colors.default.primary};
        border-radius: ${theme.borderRadius};
      }

      &:hover {
        background-color: ${theme.colors.default.primary +
        theme.transparency?.medium};
      }
    }
  `}
`;

export default Explorer;
