import { Plate, PlateContent, ParagraphPlugin, usePlateEditor } from 'platejs/react';

interface RichTextLeaf {
  [key: string]: unknown;
  text: string;
}

interface RichTextParagraph {
  [key: string]: unknown;
  children: RichTextLeaf[];
  type: 'p';
}

type RichTextValue = RichTextParagraph[];

interface BodyEditorProps {
  onChange: (value: string) => void;
  value: string;
}

export function BodyEditor({ onChange, value }: BodyEditorProps) {
  const editorValue = createEditorValue(value);
  const editor = usePlateEditor({
    plugins: [ ParagraphPlugin ],
    value: editorValue
  }, [value]);

  return (
    <Plate
      editor={editor}
      onValueChange={function handleValueChange({ value: nextValue }) {
        onChange(serializeEditorValue(nextValue as RichTextValue));
      }}
    >
      <PlateContent
        placeholder="Write the body copy here..."
        className="min-h-80 rounded-[28px] border border-black/10 bg-white px-5 py-4 text-[15px] leading-7 text-slate-800 outline-none"
      />
    </Plate>
  );
}

function createEditorValue(value: string): RichTextValue {
  const paragraphs = value
    .split(/\n\s*\n/g)
    .map(function mapParagraph(paragraph) {
      return paragraph.trim();
    })
    .filter(Boolean);

  if (!paragraphs.length) {
    return [
      {
        children: [{ text: '' }],
        type: 'p'
      }
    ];
  }

  return paragraphs.map(function mapParagraph(paragraph) {
    return {
      children: [{ text: paragraph.replace(/\n+/g, ' ') }],
      type: 'p'
    };
  });
}

function serializeEditorValue(value: RichTextValue) {
  return value
    .map(function mapParagraph(paragraph) {
      return paragraph.children
        .map(function mapChild(child) {
          return child.text;
        })
        .join('')
        .trim();
    })
    .filter(Boolean)
    .join('\n\n');
}
