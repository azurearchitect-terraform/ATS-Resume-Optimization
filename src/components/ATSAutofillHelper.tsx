import React, { useState } from 'react';
import { ArrowLeft, Copy, CheckCircle2, Download, ExternalLink, AlertCircle } from 'lucide-react';

interface ATSAutofillHelperProps {
  isDarkMode: boolean;
  resumeData: any;
  onBack: () => void;
}

export const ATSAutofillHelper: React.FC<ATSAutofillHelperProps> = ({ isDarkMode, resumeData, onBack }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadExtension = async () => {
    try {
      const response = await fetch('/extension.zip');
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AI_Resume_ATS_Autofill.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download the extension. Please try again or check your connection.');
    }
  };

  const renderField = (label: string, value: string | undefined, id: string) => {
    const displayValue = value || '';
    return (
      <div className={`p-3 rounded-lg border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/10'}`}>
        <div className="flex-1 overflow-hidden">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{label}</div>
          <div className="text-sm truncate">{displayValue || <span className="opacity-30 italic">Not provided</span>}</div>
        </div>
        <button
          onClick={() => handleCopy(displayValue, id)}
          disabled={!displayValue}
          className={`p-2 rounded-md transition-all ${
            copiedField === id 
              ? 'bg-emerald-500 text-white' 
              : isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Copy to clipboard"
        >
          {copiedField === id ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  const getExtensionJson = () => {
    if (!resumeData) return "{}";
    const payload = {
      firstName: resumeData.personal_info?.name?.split(' ')[0] || '',
      lastName: resumeData.personal_info?.name?.split(' ').slice(1).join(' ') || '',
      email: resumeData.personal_info?.email || '',
      phone: resumeData.personal_info?.phone || '',
      linkedin: resumeData.personal_info?.linkedin || '',
      github: resumeData.personal_info?.github || '',
      portfolio: resumeData.personal_info?.portfolio || '',
      experience: resumeData.experience?.map((exp: any) => ({
        company: exp.company,
        title: exp.title,
        location: exp.location,
        startDate: exp.date?.split('-')[0]?.trim() || '',
        endDate: exp.date?.split('-')[1]?.trim() || '',
        description: exp.bullets?.join('\n') || ''
      })) || [],
      education: resumeData.education?.map((edu: any) => ({
        school: edu.school,
        degree: edu.degree,
        field: edu.field,
        startDate: edu.date?.split('-')[0]?.trim() || '',
        endDate: edu.date?.split('-')[1]?.trim() || ''
      })) || []
    };
    return JSON.stringify(payload, null, 2);
  };

  const getBookmarkletCode = () => {
    const code = `javascript:(function(){
      const json = prompt('Paste your Resume JSON payload here:');
      if(!json) return;
      try {
        const data = JSON.parse(json);
        const mappings = {
          'first_name': ['first', 'fname', 'given-name'],
          'last_name': ['last', 'lname', 'family-name'],
          'email': ['email', 'mail'],
          'phone': ['phone', 'mobile', 'tel'],
          'linkedin': ['linkedin'],
          'github': ['github'],
          'portfolio': ['portfolio', 'website']
        };
        
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          const name = (input.name || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const label = (input.getAttribute('aria-label') || '').toLowerCase();
          const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
          const combined = name + id + label + placeholder;

          if (data.firstName && mappings.first_name.some(k => combined.includes(k))) input.value = data.firstName;
          if (data.lastName && mappings.last_name.some(k => combined.includes(k))) input.value = data.lastName;
          if (data.email && mappings.email.some(k => combined.includes(k))) input.value = data.email;
          if (data.phone && mappings.phone.some(k => combined.includes(k))) input.value = data.phone;
          if (data.linkedin && mappings.linkedin.some(k => combined.includes(k))) input.value = data.linkedin;
          
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        alert('Autofill complete! Please review the fields.');
      } catch(e) { alert('Invalid JSON payload. Please copy it again from the app.'); }
    })();`.replace(/\s+/g, ' ');
    return code;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold">ATS Autofill Helper</h2>
          <p className="text-xs opacity-70">Fill Workday, Greenhouse, and Lever forms easily</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Column 1: Browser Extension */}
        <div className="space-y-6 flex flex-col">
          <div className={`p-5 rounded-2xl border flex-1 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-emerald-500" />
              1. Browser Extension
            </h3>
            <p className="text-xs opacity-70 mb-4">
              Best for frequent users. Requires "Developer Mode" in Chrome.
            </p>
            
            <div className={`p-4 rounded-xl mb-4 text-[11px] ${isDarkMode ? 'bg-blue-500/10 text-blue-200' : 'bg-blue-50 text-blue-800'}`}>
              <h4 className="font-bold mb-2">Installation:</h4>
              <ol className="list-decimal list-inside space-y-1 opacity-80 mb-4">
                <li>Download and Extract ZIP.</li>
                <li>Go to <code>chrome://extensions/</code></li>
                <li>Enable <strong>Developer mode</strong>.</li>
                <li>Click <strong>Load unpacked</strong>.</li>
              </ol>
              <button 
                onClick={downloadExtension}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold"
              >
                <Download className="w-4 h-4" />
                Download ZIP
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs">Your Data Payload:</h4>
              <div className="relative">
                <textarea 
                  readOnly 
                  value={getExtensionJson()}
                  className={`w-full h-32 p-3 rounded-lg border font-mono text-[10px] focus:outline-none ${isDarkMode ? 'bg-black/50 border-white/10 text-white/70' : 'bg-gray-50 border-black/10 text-black/70'}`}
                />
                <button
                  onClick={() => handleCopy(getExtensionJson(), 'json_payload')}
                  className="absolute top-2 right-2 p-1.5 bg-emerald-500 text-black rounded-md hover:bg-emerald-400 transition-colors shadow-sm"
                >
                  {copiedField === 'json_payload' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Bookmarklet (New) */}
        <div className="space-y-6 flex flex-col">
          <div className={`p-5 rounded-2xl border flex-1 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500" />
              2. Magic Bookmarklet
            </h3>
            <p className="text-xs opacity-70 mb-4">
              <strong>No installation required!</strong> Works without Developer Mode.
            </p>
            
            <div className={`p-4 rounded-xl mb-4 text-[11px] ${isDarkMode ? 'bg-purple-500/10 text-purple-200' : 'bg-purple-50 text-purple-800'}`}>
              <h4 className="font-bold mb-2">How to use:</h4>
              <ol className="list-decimal list-inside space-y-2 opacity-80">
                <li>Copy the code below.</li>
                <li>Right-click your <strong>Bookmarks Bar</strong> {'>'} <strong>Add Page</strong>.</li>
                <li>Name it <strong>"Magic Fill"</strong>.</li>
                <li>Paste the code into the <strong>URL</strong> field.</li>
                <li>Go to a job application page and click it!</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs">Bookmarklet Code:</h4>
              <div className="relative">
                <textarea 
                  readOnly 
                  value={getBookmarkletCode()}
                  className={`w-full h-24 p-3 rounded-lg border font-mono text-[10px] focus:outline-none ${isDarkMode ? 'bg-black/50 border-white/10 text-white/70' : 'bg-gray-50 border-black/10 text-black/70'}`}
                />
                <button
                  onClick={() => handleCopy(getBookmarkletCode(), 'bookmarklet_code')}
                  className="absolute top-2 right-2 p-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-400 transition-colors shadow-sm"
                >
                  {copiedField === 'bookmarklet_code' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-[10px] opacity-50 italic">React blocks direct dragging of scripts for security. Please copy and paste into a new bookmark.</p>
            </div>
          </div>
        </div>

        {/* Column 3: Copy-Paste Helper */}
        <div className="space-y-6 flex flex-col">
          <div className={`p-5 rounded-2xl border flex-1 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-500" />
              3. Manual Helper
            </h3>
            <p className="text-xs opacity-70 mb-4">
              Quick-copy individual fields for any form.
            </p>

            {!resumeData ? (
              <div className={`p-4 rounded-xl flex items-start gap-3 ${isDarkMode ? 'bg-yellow-500/10 text-yellow-200' : 'bg-yellow-50 text-yellow-800'}`}>
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">Optimize a resume first.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {/* Personal Info */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2 opacity-80">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField("First Name", resumeData.personal_info?.name?.split(' ')[0], "fname")}
                    {renderField("Last Name", resumeData.personal_info?.name?.split(' ').slice(1).join(' '), "lname")}
                  </div>
                  {renderField("Email", resumeData.personal_info?.email, "email")}
                  {renderField("Phone", resumeData.personal_info?.phone, "phone")}
                  {renderField("LinkedIn", resumeData.personal_info?.linkedin, "linkedin")}
                  {renderField("Portfolio/GitHub", resumeData.personal_info?.github || resumeData.personal_info?.portfolio, "portfolio")}
                </div>

                {/* Experience */}
                {resumeData.experience && resumeData.experience.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm border-b pb-2 opacity-80 mt-6">Experience</h4>
                    {resumeData.experience.map((exp: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-black/5 bg-black/5'}`}>
                        {renderField("Company", exp.company, `exp_comp_${idx}`)}
                        {renderField("Title", exp.title, `exp_title_${idx}`)}
                        <div className="grid grid-cols-2 gap-3">
                          {renderField("Start Date", exp.date?.split('-')[0]?.trim(), `exp_start_${idx}`)}
                          {renderField("End Date", exp.date?.split('-')[1]?.trim(), `exp_end_${idx}`)}
                        </div>
                        {renderField("Description (Bullets)", exp.bullets?.join('\n'), `exp_desc_${idx}`)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Education */}
                {resumeData.education && resumeData.education.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm border-b pb-2 opacity-80 mt-6">Education</h4>
                    {resumeData.education.map((edu: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-black/5 bg-black/5'}`}>
                        {renderField("School", edu.school, `edu_school_${idx}`)}
                        {renderField("Degree", edu.degree, `edu_degree_${idx}`)}
                        {renderField("Field of Study", edu.field, `edu_field_${idx}`)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
