import { parse, setOptions } from 'marked';
import { Text } from 'ink';
import TerminalRenderer, {
  type TerminalRendererOptions,
} from 'marked-terminal';

export type Props = TerminalRendererOptions & {
  content: string;
};

export function Markdown({ content, ...options }: Props) {
  // @ts-expect-error - TerminalRenderer is not typed correctly
  setOptions({ renderer: new TerminalRenderer(options) });
  return <Text>{(parse(content) as string).trim()}</Text>;
}
