import { Terminal as XTerm } from "xterm";

import { countLines, offsetToColRow } from "./tty-utils";
import { ActiveCharPrompt, ActivePrompt } from "./shell-utils";
import { PgTerminal } from "./terminal";

/**
 * A tty is a particular device file, that sits between the shell and the terminal.
 * It acts an an interface for the shell and terminal to read/write from
 * and communicate with one another
 */
export class PgTty {
  private _xterm: XTerm;
  private _termSize: {
    cols: number;
    rows: number;
  };
  private _firstInit: boolean = true;
  private _promptPrefix: string;
  private _continuationPromptPrefix: string;
  private _cursor: number;
  private _input: string;

  constructor(xterm: XTerm) {
    this._xterm = xterm;

    this._termSize = {
      cols: this._xterm.cols,
      rows: this._xterm.rows,
    };
    this._promptPrefix = "";
    this._continuationPromptPrefix = "";
    this._input = "";
    this._cursor = 0;
  }

  /**
   * Return a promise that will resolve when the user has completed
   * typing a single line
   */
  read(
    promptPrefix: string,
    continuationPromptPrefix: string = PgTerminal.CONTINUATION_PROMPT_PREFIX
  ): ActivePrompt {
    if (promptPrefix.length > 0) {
      this.print(promptPrefix);
    }

    this._firstInit = true;
    this._promptPrefix = promptPrefix;
    this._continuationPromptPrefix = continuationPromptPrefix;
    this._input = "";
    this._cursor = 0;

    return {
      promptPrefix,
      continuationPromptPrefix,
      ...this._getAsyncRead(),
    };
  }

  /**
   * Return a promise that will be resolved when the user types a single
   * character.
   *
   * This can be active in addition to `.read()` and will be resolved in
   * priority before it.
   */
  readChar(promptPrefix: string): ActiveCharPrompt {
    if (promptPrefix.length > 0) {
      this.print(promptPrefix);
    }

    return {
      promptPrefix,
      ...this._getAsyncRead(),
    };
  }

  /**
   * Prints a message and changes line
   */
  println(message: string) {
    this.print(message + "\n");
  }

  /**
   * Prints a message and properly handles new-lines
   */
  print(message: string, sync?: boolean) {
    const normInput = message.replace(/[\r\n]+/g, "\n").replace(/\n/g, "\r\n");
    if (sync) {
      // We write it synchronously via hacking a bit on xterm

      //@ts-ignore
      this._xterm._core.writeSync(normInput);
      //@ts-ignore
      this._xterm._core._renderService._renderer._runOperation((renderer) =>
        renderer.onGridChanged(0, this._xterm.rows - 1)
      );
    } else {
      this._xterm.write(normInput);
    }
  }

  /**
   * Prints a list of items using a wide-format
   */
  printWide(items: Array<string>, padding = 2) {
    if (items.length === 0) return this.println("");

    // Compute item sizes and matrix row/cols
    const itemWidth =
      items.reduce((width, item) => Math.max(width, item.length), 0) + padding;
    const wideCols = Math.floor(this._termSize.cols / itemWidth);
    const wideRows = Math.ceil(items.length / wideCols);

    // Print matrix
    let i = 0;
    for (let row = 0; row < wideRows; ++row) {
      let rowStr = "";

      // Prepare columns
      for (let col = 0; col < wideCols; ++col) {
        if (i < items.length) {
          let item = items[i++];
          item += " ".repeat(itemWidth - item.length);
          rowStr += item;
        }
      }
      this.println(rowStr);
    }
  }

  /**
   * Prints a status message on the current line. Meant to be used with clearStatus()
   */
  printStatus(message: string, sync?: boolean) {
    // Save the cursor position
    this.print("\u001b[s", sync);
    this.print(message, sync);
  }

  /**
   * Clears the current status on the line, meant to be run after printStatus
   */
  clearStatus(sync?: boolean) {
    // Restore the cursor position
    this.print("\u001b[u", sync);
    // Clear from cursor to end of screen
    this.print("\u001b[1000D", sync);
    this.print("\u001b[0J", sync);
  }

  /**
   * Clears the current prompt
   *
   * This function will erase all the lines that display the current prompt
   * and move the cursor in the beginning of the first line of the prompt.
   */
  clearInput() {
    const currentPrompt = this._applyPrompts(this._input);

    // Get the overall number of lines to clear
    const allRows = countLines(currentPrompt, this._termSize.cols);

    // Get the line we are currently in
    const promptCursor = this._applyPromptOffset(this._input, this._cursor);
    const { row } = offsetToColRow(
      currentPrompt,
      promptCursor,
      this._termSize.cols
    );

    // First move on the last line
    const moveRows = allRows - row - 1;
    for (let i = 0; i < moveRows; ++i) this._xterm.write("\x1b[E");

    // Clear current input line(s)
    this._xterm.write("\r\x1b[K");
    for (let i = 1; i < allRows; ++i) this._xterm.write("\x1b[F\x1b[K");
  }

  /**
   * This function clears all xterm buffer
   */
  clear() {
    this._xterm.clear();
  }

  /**
   * Clears the entire Tty
   *
   * This function will erase all the lines that display on the tty,
   * and move the cursor in the beginning of the first line of the prompt.
   */
  clearTty() {
    // Clear the screen
    this._xterm.write("\x1b[2J");
    // Set the cursor to 0, 0
    this._xterm.write("\x1b[0;0H");
    // Scroll to bottom
    this._xterm.scrollToBottom();
  }

  /**
   * Clear the entire current line
   */
  clearCurrentLine() {
    // Clears the whole line
    this.print(`\x1b[G`);
    // This also clears the line but helps with parsing errors
    this.print(`\x1b[2K`);
  }

  /**
   * Function to return if it is the initial read
   */
  getFirstInit(): boolean {
    return this._firstInit;
  }

  /**
   * Function to get the current Prompt prefix
   */
  getPromptPrefix(): string {
    return this._promptPrefix;
  }

  /**
   * Function to get the current Continuation Prompt prefix
   */
  getContinuationPromptPrefix(): string {
    return this._continuationPromptPrefix;
  }

  /**
   * Function to get the terminal size
   */
  getTermSize(): { rows: number; cols: number } {
    return this._termSize;
  }

  /**
   * Function to get the current input in the line
   */
  getInput(): string {
    return this._input;
  }

  /**
   * Function to get the current cursor
   */
  getCursor(): number {
    return this._cursor;
  }

  /**
   * Function to get the size (columns and rows)
   */
  getSize(): { cols: number; rows: number } {
    return this._termSize;
  }

  /**
   * Function to return the terminal buffer
   */
  getBuffer() {
    return this._xterm.buffer.active;
  }

  /**
   * @param offset how many lines before the current line
   *
   * @returns the current line as string
   */
  getCurrentLineString(offset: number = 0) {
    return this._getCurrentLine(offset)?.translateToString();
  }

  /**
   * Gets whether the current input starts with prompt
   *
   * Useful for PgTerm.fit()
   */
  getInputStartsWithPrompt() {
    for (let i = 0; i < 10; i++) {
      const currentLine = this._getCurrentLine(i);
      if (!currentLine) return;

      if (!currentLine.isWrapped) {
        const currentLineStr = currentLine.translateToString();
        return (
          currentLineStr.startsWith(PgTerminal.PROMPT) ||
          currentLineStr.startsWith(PgTerminal.CONTINUATION_PROMPT_PREFIX)
        );
      }
    }
  }

  /**
   * Replace input with the new input given
   *
   * This function clears all the lines that the current input occupies and
   * then replaces them with the new input.
   */
  setInput(newInput: string, shouldNotClearInput: boolean = false) {
    // Doing the programming anitpattern here,
    // because defaulting to true is the opposite of what
    // not passing a param means in JS
    if (!shouldNotClearInput) {
      this.clearInput();
    }

    // Write the new input lines, including the current prompt
    const newPrompt = this._applyPrompts(newInput);
    this.print(newPrompt);

    // Trim cursor overflow
    if (this._cursor > newInput.length) {
      this._cursor = newInput.length;
    }

    // Move the cursor to the appropriate row/col
    const newCursor = this._applyPromptOffset(newInput, this._cursor);
    const newLines = countLines(newPrompt, this._termSize.cols);
    const { col, row } = offsetToColRow(
      newPrompt,
      newCursor,
      this._termSize.cols
    );
    const moveUpRows = newLines - row - 1;

    this._xterm.write("\r");
    for (let i = 0; i < moveUpRows; ++i) this._xterm.write("\x1b[F");
    for (let i = 0; i < col; ++i) this._xterm.write("\x1b[C");

    // Replace input
    this._input = newInput;
  }

  /**
   * Set the new cursor position, as an offset on the input string
   *
   * This function:
   * - Calculates the previous and current
   */
  setCursor(newCursor: number) {
    if (newCursor < 0) newCursor = 0;
    if (newCursor > this._input.length) newCursor = this._input.length;
    this._writeCursorPosition(newCursor);
  }

  /**
   * Sets the direct cursor value. Should only be used in keystroke contexts
   */
  setCursorDirectly(newCursor: number) {
    this._writeCursorPosition(newCursor);
  }

  setTermSize(cols: number, rows: number) {
    this._termSize = { cols, rows };
  }

  setFirstInit(value: boolean) {
    this._firstInit = value;
  }

  setPromptPrefix(value: string) {
    this._promptPrefix = value;
  }

  setContinuationPromptPrefix(value: string) {
    this._continuationPromptPrefix = value;
  }

  /**
   * Function to return a deconstructed readPromise
   */
  private _getAsyncRead() {
    let readResolve;
    let readReject;
    const readPromise = new Promise((resolve, reject) => {
      readResolve = (response: string) => {
        this._promptPrefix = "";
        this._continuationPromptPrefix = "";
        resolve(response);
      };
      readReject = reject;
    });

    return {
      promise: readPromise,
      resolve: readResolve,
      reject: readReject,
    };
  }

  /**
   * Apply prompts to the given input
   */
  private _applyPrompts(input: string): string {
    return (
      this._promptPrefix +
      input.replace(/\n/g, "\n" + this._continuationPromptPrefix)
    );
  }

  /**
   * Function to get the current line
   */
  private _getCurrentLine(offset: number = 0) {
    const buffer = this.getBuffer();
    return buffer.getLine(buffer.baseY + buffer.cursorY - offset);
  }

  /**
   * Advances the `offset` as required in order to accompany the prompt
   * additions to the input.
   */
  private _applyPromptOffset(input: string, offset: number): number {
    const newInput = this._applyPrompts(input.substring(0, offset));
    return newInput.length;
  }

  private _writeCursorPosition(newCursor: number) {
    // Apply prompt formatting to get the visual status of the display
    const inputWithPrompt = this._applyPrompts(this._input);
    // const inputLines = countLines(inputWithPrompt, this._termSize.cols);

    // Estimate previous cursor position
    const prevPromptOffset = this._applyPromptOffset(this._input, this._cursor);
    const { col: prevCol, row: prevRow } = offsetToColRow(
      inputWithPrompt,
      prevPromptOffset,
      this._termSize.cols
    );

    // Estimate next cursor position
    const newPromptOffset = this._applyPromptOffset(this._input, newCursor);
    const { col: newCol, row: newRow } = offsetToColRow(
      inputWithPrompt,
      newPromptOffset,
      this._termSize.cols
    );

    // Adjust vertically
    if (newRow > prevRow) {
      for (let i = prevRow; i < newRow; ++i) this._xterm.write("\x1b[B");
    } else {
      for (let i = newRow; i < prevRow; ++i) this._xterm.write("\x1b[A");
    }

    // Adjust horizontally
    if (newCol > prevCol) {
      for (let i = prevCol; i < newCol; ++i) this._xterm.write("\x1b[C");
    } else {
      for (let i = newCol; i < prevCol; ++i) this._xterm.write("\x1b[D");
    }

    // Set new offset
    this._cursor = newCursor;
  }
}
