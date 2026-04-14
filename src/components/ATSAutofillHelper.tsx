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

  const downloadExtension = () => {
    const link = document.createElement('a');
    link.href = '/extension.zip';
    link.download = 'AI_Resume_ATS_Autofill.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Browser Extension */}
        <div className="space-y-6">
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-emerald-500" />
              1. Browser Extension (Recommended)
            </h3>
            <p className="text-sm opacity-70 mb-4">
              Install our Chrome extension to automatically inject your optimized resume data directly into Workday and Greenhouse forms with one click.
            </p>
            
            <div className={`p-4 rounded-xl mb-4 text-sm ${isDarkMode ? 'bg-blue-500/10 text-blue-200' : 'bg-blue-50 text-blue-800'}`}>
              <h4 className="font-bold mb-2">How to install:</h4>
              <ol className="list-decimal list-inside space-y-1 opacity-80 mb-4">
                <li>Download the extension files.</li>
                <li>Extract the downloaded ZIP file.</li>
                <li>Open Chrome and go to <code>chrome://extensions/</code></li>
                <li>Enable <strong>Developer mode</strong> (top right).</li>
                <li>Click <strong>Load unpacked</strong> and select the extracted folder.</li>
              </ol>
              <button 
                onClick={downloadExtension}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold text-xs"
              >
                <Download className="w-4 h-4" />
                Download Extension ZIP
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm">Your Data Payload:</h4>
              <p className="text-xs opacity-70">Copy this JSON and paste it into the extension popup when you are on a job application page.</p>
              <div className="relative">
                <textarea 
                  readOnly 
                  value={getExtensionJson()}
                  className={`w-full h-48 p-3 rounded-lg border font-mono text-xs focus:outline-none ${isDarkMode ? 'bg-black/50 border-white/10 text-white/70' : 'bg-gray-50 border-black/10 text-black/70'}`}
                />
                <button
                  onClick={() => handleCopy(getExtensionJson(), 'json_payload')}
                  className="absolute top-2 right-2 p-2 bg-emerald-500 text-black rounded-md hover:bg-emerald-400 transition-colors shadow-sm"
                >
                  {copiedField === 'json_payload' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Copy-Paste Helper */}
        <div className="space-y-6">
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-500" />
              2. Manual Copy-Paste Helper
            </h3>
            <p className="text-sm opacity-70 mb-4">
              If you don't want to use the extension, use these quick-copy buttons to manually paste your optimized data into the application forms.
            </p>

            {!resumeData ? (
              <div className={`p-4 rounded-xl flex items-start gap-3 ${isDarkMode ? 'bg-yellow-500/10 text-yellow-200' : 'bg-yellow-50 text-yellow-800'}`}>
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">You need to optimize a resume in the Builder tab first to generate this data.</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
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
