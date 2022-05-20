import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import styled, { css, useTheme } from "styled-components";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import Theme from "../../../../theme/interface";
import { getExtensions } from "./extensions";
import {
  buildCountAtom,
  explorerAtom,
  refreshExplorerAtom,
} from "../../../../state";
import autosave from "./autosave";
import { PgExplorer } from "../../../../utils/pg/explorer";
import { Wormhole } from "../../../Loading";
import { PgProgramInfo } from "../../../../utils/pg/program-info";

const Editor = () => {
  const [explorer] = useAtom(explorerAtom);
  const [explorerChanged] = useAtom(refreshExplorerAtom); // to re-render on demand

  const [noOpenTabs, setNoOpenTabs] = useState(false);

  const parent = useRef<HTMLDivElement>(null);

  const theme = useTheme() as Theme;

  const editorTheme = useMemo(() => {
    return EditorView.theme(
      {
        // Editor
        "&": {
          height: "100%",
        },
        // Cursor
        "& .cm-cursor": {
          borderLeft:
            "2px solid " +
            (theme.colors.editor?.cursor?.color ??
              theme.colors.default.textSecondary),
        },
        // Gutters
        "& .cm-gutters": {
          backgroundColor: theme.colors.editor?.gutter?.bg ?? "inherit",
          color: theme.colors.editor?.gutter?.color ?? "inherit",
          borderRight: "none",
        },
        "& .cm-activeLineGutter": {
          backgroundColor: theme.colors.editor?.gutter?.activeBg ?? "inherit",
          color: theme.colors.editor?.gutter?.activeColor ?? "inherit",
        },
        "& .cm-gutterElement:nth-child(1)": {
          padding: "0.125rem",
        },
        "& .cm-scroller": {
          fontFamily: "inherit",
        },
        // Line
        "& .cm-line": {
          border: "1.5px solid transparent",
        },
        "& .cm-activeLine": {
          backgroundColor: theme.colors.editor?.activeLine?.bg ?? "inherit",
          borderColor:
            theme.colors.editor?.activeLine?.borderColor ?? "transparent",
          borderRightColor: "transparent",
          borderLeftColor: "transparent",
        },
        // Selection
        "& .cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
          backgroundColor:
            theme.colors.editor?.selection?.bg ??
            theme.colors.default.primary + theme.transparency?.medium,
          color: theme.colors.editor?.selection?.color ?? "inherit",
        },
        "& .cm-selectionMatch": {
          backgroundColor:
            theme.colors.editor?.selection?.bg ??
            theme.colors.default.textPrimary + theme.transparency?.medium,
          color: theme.colors.editor?.selection?.color ?? "inherit",
        },
        // Tooltip
        ".cm-tooltip": {
          backgroundColor:
            theme.colors.editor?.tooltip?.bg ?? theme.colors.default.bg,
          color: theme.colors.default.textPrimary,
          border: "1px solid " + theme.colors.default.borderColor,
        },
        ".cm-tooltip-autocomplete": {
          "& > ul > li[aria-selected]": {
            backgroundColor:
              theme.colors.default.primary + theme.transparency?.medium,
          },
        },
        // Panels
        ".cm-panels": {
          backgroundColor: theme.colors?.right?.bg ?? "inherit",
          color: theme.colors.default.textPrimary,
          width: "fit-content",
          height: "fit-content",
          position: "fixed",
          top: 0,
          right: "10%",
          left: "auto",
        },
        // Search
        ".cm-searchMatch": {
          backgroundColor:
            theme.colors.editor?.searchMatch?.bg ??
            theme.colors.default.textSecondary + theme.transparency?.medium,
          color: theme.colors?.editor?.searchMatch?.color ?? "inherit",
        },
        ".cm-searchMatch-selected": {
          backgroundColor:
            theme.colors.editor?.searchMatch?.selectedBg ??
            theme.colors.default.primary + theme.transparency?.medium,
          color: theme.colors?.editor?.searchMatch?.color ?? "inherit",
        },
        // Search popup
        ".cm-panel.cm-search": {
          backgroundColor: theme.colors?.right?.bg ?? "inherit",

          "& input, & button, & label": {
            margin: ".2em .6em .2em 0",
          },
          "& input[type=checkbox]": {
            marginRight: ".2em",
          },
          "& label": {
            fontSize: "80%",
            whiteSpace: "pre",
          },

          "& label:nth-of-type(2)": {
            marginRight: "1.5rem",
          },

          "& button[name=close]": {
            position: "absolute",
            top: "0.25rem",
            right: "0.25rem",
            margin: 0,
            width: "1rem",
            height: "1rem",
            color: theme.colors.default.textPrimary,
            backgroundColor: "inherit",
            borderRadius: "0.25rem",

            "&:hover": {
              cursor: "pointer",
              backgroundColor: theme.colors.default.bg,
            },
          },
        },
      },
      { dark: theme.isDark }
    );

    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.name]);

  const removeEditor = useCallback(() => {
    if (parent.current?.hasChildNodes())
      parent.current.removeChild(parent.current.childNodes[0]);
  }, []);

  const getCurFile = useCallback(() => {
    return explorer?.getCurrentFile();
  }, [explorer]);

  // Editor configuration
  useEffect(() => {
    // If there is no tab open, show Home screen
    if (!explorer?.getTabs().length) {
      setNoOpenTabs(true);
      return;
    }

    setNoOpenTabs(false);

    if (!parent.current) return;

    // Get current file
    const curFile = getCurFile();
    if (!curFile) return;

    // Change selected
    // won't work on mount
    const newEl = PgExplorer.getElFromPath(curFile.path);
    if (newEl) PgExplorer.setSelectedEl(newEl);

    // Open all parents
    // won't work on mount
    PgExplorer.openAllParents(curFile.path);

    removeEditor();

    new EditorView({
      state: EditorState.create({
        doc: curFile.content,
        extensions: [
          getExtensions(),
          editorTheme,
          theme.highlight,
          autosave(explorer, curFile, 5000),
        ],
      }),
      parent: parent.current,
    });
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    explorerChanged,
    explorer,
    editorTheme,
    noOpenTabs,
    removeEditor,
    setNoOpenTabs,
  ]);

  // Update programId on each build
  const [buildCount] = useAtom(buildCountAtom);

  // Change programId
  useEffect(() => {
    if (!explorer || !parent.current || !buildCount) return;

    const curFile = getCurFile();
    if (!curFile) return;

    const programPkResult = PgProgramInfo.getPk();
    if (programPkResult?.err) return;

    removeEditor();

    const editor = new EditorView({
      state: EditorState.create({
        doc: curFile.content,
        extensions: [
          getExtensions(),
          editorTheme,
          theme.highlight,
          autosave(explorer, curFile, 5000),
        ],
      }),
      parent: parent.current,
    });

    const code = editor.state.doc.toString();
    const findText = "declare_id!";
    const findTextIndex = code.indexOf(findText);
    if (findTextIndex === -1) return;

    const quoteStartIndex = findTextIndex + findText.length + 2;
    const quoteEndIndex = code.indexOf('"', quoteStartIndex);

    if (code.length < quoteStartIndex + 3) return;

    editor.dispatch({
      changes: {
        from: quoteStartIndex,
        to: quoteEndIndex,
        insert: programPkResult.programPk?.toBase58(),
      },
    });

    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildCount, removeEditor]);

  if (!explorer)
    return (
      <LoadingWrapper>
        <Wormhole size={10} />
      </LoadingWrapper>
    );

  // TODO: Home screen
  if (noOpenTabs)
    return <Wrapper>Professional looking home screen coming soon.</Wrapper>;

  return <Wrapper ref={parent}></Wrapper>;
};

export const EDITOR_SCROLLBAR_WIDTH = "0.75rem";

const Wrapper = styled.div`
  ${({ theme }) => css`
    flex: 1;
    overflow: auto;
    background-color: ${theme.colors?.editor?.bg};
    color: ${theme.colors?.editor?.text?.color};

    /* Scrollbar */
    /* Chromium */
    & ::-webkit-scrollbar {
      width: ${EDITOR_SCROLLBAR_WIDTH};
    }

    & ::-webkit-scrollbar-track {
      background-color: ${theme.colors.right?.bg ?? theme.colors.default.bg};
      border-left: 1px solid ${theme.colors.default.borderColor};
    }

    & ::-webkit-scrollbar-thumb {
      border: 0.25rem solid transparent;
      background-color: ${theme.colors.scrollbar?.thumb.color};
    }

    & ::-webkit-scrollbar-thumb:hover {
      background-color: ${theme.colors.scrollbar?.thumb.hoverColor};
    }
  `}
`;

const LoadingWrapper = styled.div`
  flex: 1;
  display: flex;
`;

export default Editor;
