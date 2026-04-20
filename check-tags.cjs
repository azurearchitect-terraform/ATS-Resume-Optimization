const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');
let stack = [];
for (let i = 0; i < lines.length; i++) {
    let text = lines[i];
    let l = text.replace(/<(div|section|motion\.div|button|span|input|textarea|label|h1|h2|h3|p|ul|li|a|img|svg|path|footer|main|header|AnimatePresence|motion\.section|motion\.header|LinkedInImporter|ResumeUploader|ResumeReviewer|ResumePreview|AuthModal|ChevronDown|Layout|Download|Trash2|CheckCircle2|Check|Info|Zap|Cpu|Users|ArrowRight|Cloud|Briefcase|Shield|Globe|Smartphone|Target|RefreshCw|Loader2|AlertCircle)[^>]*\/>/g, '');
    let matches = l.match(/<(div|section|motion\.div|button|span|input|textarea|label|h1|h2|h3|p|ul|li|a|img|svg|path|footer|main|header|AnimatePresence|motion\.section|motion\.header|LinkedInImporter|ResumeUploader|ResumeReviewer|ResumePreview|AuthModal|ChevronDown|Layout|Download|Trash2|CheckCircle2|Check|Info|Zap|Cpu|Users|ArrowRight|Cloud|Briefcase|Shield|Globe|Smartphone|Target|RefreshCw|Loader2|AlertCircle)|<\/(div|section|motion\.div|button|span|input|textarea|label|h1|h2|h3|p|ul|li|a|img|svg|path|footer|main|header|AnimatePresence|motion\.section|motion\.header|LinkedInImporter|ResumeUploader|ResumeReviewer|ResumePreview|AuthModal|ChevronDown|Layout|Download|Trash2|CheckCircle2|Check|Info|Zap|Cpu|Users|ArrowRight|Cloud|Briefcase|Shield|Globe|Smartphone|Target|RefreshCw|Loader2|AlertCircle)/g) || [];
    matches.forEach(t => {
        if (t.startsWith('</')) {
            let expected = t.substring(2);
            if (stack.length === 0) {
                console.log('UNDERFLOW line ' + (i+1) + ': ' + t);
            } else {
                let actual = stack.pop();
                if (actual.tag !== expected) {
                    console.log('MISMATCH line ' + (i+1) + ': Found ' + t + ' but expected </' + actual.tag + ' (opened at ' + actual.line + ')');
                }
            }
        } else {
            stack.push({ tag: t.substring(1), line: i + 1 });
        }
    });
}
console.log('Final stack:', JSON.stringify(stack, null, 2));
