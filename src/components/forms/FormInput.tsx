import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormInput: React.FC<FormInputProps> = ({ label, error, className, ...props }) => {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        className={`form-control ${error ? 'border-danger' : ''} ${className || ''}`}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--danger-hover)', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
};
