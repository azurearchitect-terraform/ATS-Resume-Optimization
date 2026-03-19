import React, { useState } from 'react';
import { ResumeElement } from '../../types/resume';
import { useResumeStore } from '../../store/useResumeStore';
import { cn } from '../../lib/utils';
import { Mail, Phone, MapPin, Globe, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { improveTextWithAI } from '../../services/aiService';

export const SectionRenderer = ({ element }: { element: ResumeElement }) => {
  const { updateElement, jobDescription, targetRole } = useResumeStore();
  const [isImproving, setIsImproving] = useState(false);

  const handleContentChange = (key: string, value: any) => {
    updateElement(element.id, {
      content: { ...element.content, [key]: value },
    });
  };

  const handleImproveWithAI = async () => {
    if (!element.content.text) return;
    
    setIsImproving(true);
    try {
      const improved = await improveTextWithAI(element.content.text, { jobDescription, targetRole });
      handleContentChange('text', improved);
    } catch (error) {
      console.error('AI Improvement Error:', error);
    } finally {
      setIsImproving(false);
    }
  };

  const handleItemChange = (key: string, index: number, field: string, value: any) => {
    const newItems = [...element.content[key]];
    newItems[index] = { ...newItems[index], [field]: value };
    handleContentChange(key, newItems);
  };

  const handleAddItem = (key: string, defaultItem: any) => {
    handleContentChange(key, [...(element.content[key] || []), defaultItem]);
  };

  const handleRemoveItem = (key: string, index: number) => {
    handleContentChange(key, element.content[key].filter((_: any, i: number) => i !== index));
  };

  switch (element.type) {
    case 'header':
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-8 w-full">
            {element.content.avatar && (
              <div className="relative group">
                <img 
                  src={element.content.avatar} 
                  alt="Avatar" 
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <span className="text-white text-[10px] font-bold">Change</span>
                </div>
              </div>
            )}
            <div className="flex-1">
              <input
                value={element.content.name}
                onChange={(e) => handleContentChange('name', e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 font-bold text-4xl p-0"
                placeholder="Your Name"
              />
              <input
                value={element.content.title}
                onChange={(e) => handleContentChange('title', e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 text-xl text-gray-600 p-0 mt-1"
                placeholder="Professional Title"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-y-2 gap-x-4 w-full text-sm text-gray-600 mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-gray-400" />
              <input
                value={element.content.email}
                onChange={(e) => handleContentChange('email', e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-xs w-full"
                placeholder="Email"
              />
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-gray-400" />
              <input
                value={element.content.phone}
                onChange={(e) => handleContentChange('phone', e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-xs w-full"
                placeholder="Phone"
              />
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-gray-400" />
              <input
                value={element.content.location}
                onChange={(e) => handleContentChange('location', e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-xs w-full"
                placeholder="Location"
              />
            </div>
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-gray-400" />
              <input
                value={element.content.website}
                onChange={(e) => handleContentChange('website', e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-xs w-full"
                placeholder="Website"
              />
            </div>
          </div>
        </div>
      );

    case 'experience':
    case 'education':
      const isExp = element.type === 'experience';
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1">
            <input
              value={element.content.title}
              onChange={(e) => handleContentChange('title', e.target.value)}
              className="bg-transparent border-none focus:ring-0 p-0 w-full"
              placeholder="Section Title"
            />
            <button 
              onClick={() => handleAddItem('items', isExp ? { company: '', role: '', period: '', description: '' } : { school: '', degree: '', period: '' })}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
            >
              + Add Item
            </button>
          </div>
          <div className="space-y-6">
            {element.content.items?.map((item: any, idx: number) => (
              <div key={idx} className="group relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <input
                      value={isExp ? item.role : item.degree}
                      onChange={(e) => handleItemChange('items', idx, isExp ? 'role' : 'degree', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 font-bold p-0"
                      placeholder={isExp ? "Role" : "Degree"}
                    />
                    <input
                      value={isExp ? item.company : item.school}
                      onChange={(e) => handleItemChange('items', idx, isExp ? 'company' : 'school', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 p-0 italic"
                      placeholder={isExp ? "Company" : "School"}
                    />
                  </div>
                  <input
                    value={item.period}
                    onChange={(e) => handleItemChange('items', idx, 'period', e.target.value)}
                    className="bg-transparent border-none focus:ring-0 p-0 text-right w-32 opacity-60"
                    placeholder="Period"
                  />
                </div>
                {isExp && (
                  <textarea
                    value={item.description}
                    onChange={(e) => handleItemChange('items', idx, 'description', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[60px]"
                    placeholder="Describe your achievements..."
                  />
                )}
                <button 
                  onClick={() => handleRemoveItem('items', idx)}
                  className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      );

    case 'skills':
      return (
        <div className="space-y-3">
          <div className="border-b-2 border-gray-900 pb-1">
            <input
              value={element.content.title}
              onChange={(e) => handleContentChange('title', e.target.value)}
              className="bg-transparent border-none focus:ring-0 p-0 w-full"
              placeholder="Section Title"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {element.content.items?.map((skill: string, idx: number) => (
              <div key={idx} className="group relative flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm font-medium">
                <input
                  value={skill}
                  onChange={(e) => {
                    const newSkills = [...element.content.items];
                    newSkills[idx] = e.target.value;
                    handleContentChange('items', newSkills);
                  }}
                  className="bg-transparent border-none focus:ring-0 p-0 w-20 text-center"
                />
                <button 
                  onClick={() => {
                    const newSkills = element.content.items.filter((_: any, i: number) => i !== idx);
                    handleContentChange('items', newSkills);
                  }}
                  className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
            <button 
              onClick={() => handleContentChange('items', [...(element.content.items || []), 'New Skill'])}
              className="px-3 py-1 rounded-full border border-dashed border-gray-300 text-sm text-gray-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-2">
          <div className="border-b-2 border-gray-900 pb-1 flex justify-between items-center">
            <input
              value={element.content.title}
              onChange={(e) => handleContentChange('title', e.target.value)}
              className="bg-transparent border-none focus:ring-0 p-0 w-full"
              placeholder="Section Title"
            />
            <button 
              onClick={handleImproveWithAI}
              disabled={isImproving}
              className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {isImproving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {isImproving ? 'Improving...' : 'Improve with AI'}
            </button>
          </div>
          <textarea
            value={element.content.text}
            onChange={(e) => handleContentChange('text', e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[80px]"
            placeholder="Enter your summary or content..."
          />
        </div>
      );

    default:
      return <div>Unknown element type</div>;
  }
};
