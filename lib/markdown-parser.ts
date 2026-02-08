export const parseMarkdown = (text: string): string => {
    let html = text;

    // Headers (### -> <h3>, ## -> <h2>, # -> <h1>)
    // We process from h6 down to h1 to avoid conflict
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic (*text*)
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Unordered Lists
    // This is a simple regex that wraps lines starting with - or * with <li>
    // Wrapping with <ul> is trickier with simple regex, but Tiptap might handle <li> sequences if pasted as HTML.
    // However, Tiptap prefers valid HTML.
    // Let's just convert bullets to <li> and wrap the whole block? No, that breaks other things.
    // Better approach for simple lists:
    // replace -/ * at start of line with <li>...</li>
    // Note: This simple parser won't handle nested lists perfectly or wrap in <ul>, 
    // but Tiptap often accepts <li> elements or we can wrap contiguous <li>s.
    // For Tiptap `insertContent`, <ul><li>...</li></ul> is best.

    // Let's do a block-based approach for lists if possible, or just simple replacements
    // Simple replacement for bullet points
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');

    // Ordered Lists
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Line breaks to <br> (but not inside tags? Regex replace is risky)
    // Tiptap handles paragraphs usually.
    // A better strategy for the AI summary which is mostly paragraphs:
    // Convert double newlines to <p> tags?

    // Let's refine:
    // 1. Split by double newlines to get blocks.
    // 2. Process each block.
    // 3. Join.

    // For now, sticking to the simple replacements requested.
    // Adjust newlines:
    html = html.replace(/\n/gim, '<br>');

    // Fix the list wrapping (a bit hacky but often works for simple AI output)
    // If we have <li>...</li><br><li>, we can try to wrap.
    // But honestly, Tiptap is smart. Let's see if <li> works.
    // If not, we might need a slightly more robust list handler.

    return html;
};

export const parseMarkdownToHTML = (text: string): string => {
    // Basic implementation
    let lines = text.split('\n');
    let output = [];
    let inList = false;
    let listType = null; // 'ul' or 'ol'

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Skip empty lines in lists to avoid breaking them too easily, 
        // or treat empty lines as breaks?
        if (line === '') {
            if (inList) {
                output.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = false;
                listType = null;
            }
            // Ignore empty lines. Block elements (p, h1, etc.) provide sufficient spacing.
            continue;
        }

        // Headers
        const headerMatch = line.match(/^#{1,6}\s/);
        if (headerMatch) {
            if (inList) {
                output.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = false;
            }
            const level = headerMatch[0].length - 1; // -1 because of whitespace? No, length includes whitespace. 
            // regex is ^#{1,6}\s. length is num # + 1. So level is length - 1.
            const content = line.replace(/^#{1,6}\s/, '');
            output.push(`<h${level}>${parseInline(content)}</h${level}>`);
            continue;
        }

        // Unordered List
        if (line.match(/^[-*]\s/)) {
            if (!inList || listType !== 'ul') {
                if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = true;
                listType = 'ul';
                output.push('<ul>');
            }
            output.push(`<li>${parseInline(line.replace(/^[-*]\s/, ''))}</li>`);
            continue;
        }

        // Ordered List
        if (line.match(/^\d+\.\s/)) {
            if (!inList || listType !== 'ol') {
                if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = true;
                listType = 'ol';
                output.push('<ol>');
            }
            output.push(`<li>${parseInline(line.replace(/^\d+\.\s/, ''))}</li>`);
            continue;
        }

        // Close list if we encounter a non-list line
        if (inList) {
            output.push(listType === 'ul' ? '</ul>' : '</ol>');
            inList = false;
            listType = null;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            output.push(`<blockquote>${parseInline(line.replace(/^> /, ''))}</blockquote>`);
            continue;
        }

        // Paragraph (default)
        output.push(`<p>${parseInline(line)}</p>`);
    }

    if (inList) {
        output.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    return output.join('');
};

const parseInline = (text: string): string => {
    let html = text;
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    return html;
};
