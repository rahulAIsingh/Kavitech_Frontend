import React from 'react';

interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export const FormButton: React.FC<FormButtonProps> = ({
  children,
  variant = 'primary',
  loading = false,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} ${className || ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderBottomColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.75s linear infinite',
            }}
          />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};
