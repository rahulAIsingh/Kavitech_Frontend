import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, className, ...props }) => {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select
        className={`form-control ${error ? 'border-danger' : ''} ${className || ''}`}
        {...props}
      >
        {options.map((opt, index) => (
          <option key={index} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--danger-hover)', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
};
