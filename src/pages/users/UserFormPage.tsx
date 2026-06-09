import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { FormButton } from '../../components/forms/FormButton';
import { Toast } from '../../components/feedback/Toast';

export const UserFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [role, setRole] = useState('User');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'danger'>('success');

  useEffect(() => {
    if (isEditMode) {
      loadUser();
    }
  }, [id]);

  const loadUser = async () => {
    setFetching(true);
    try {
      const u = await userApi.getById(parseInt(id!));
      setFirstName(u.firstName);
      setLastName(u.lastName);
      setEmail(u.email);
      setIsActive(u.isActive);
      setRole(u.roles[0] || 'User');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load user details.');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEditMode) {
        await userApi.update(parseInt(id!), {
          firstName,
          lastName,
          isActive,
          roles: [role],
        });
        setToastType('success');
        setToastMessage('User updated successfully!');
      } else {
        await userApi.create({
          firstName,
          lastName,
          email,
          password,
          roles: [role],
        });
        setToastType('success');
        setToastMessage('User created successfully!');
      }

      setTimeout(() => {
        navigate('/users');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit form.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading user profile...</span>
      </div>
    );
  }

  const roleOptions = [
    { value: 'User', label: 'Standard User' },
    { value: 'SuperAdmin', label: 'Super Admin' },
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">{isEditMode ? 'Edit User' : 'Create New User'}</h1>
        <Link to="/users" className="btn btn-secondary">
          Back to List
        </Link>
      </div>

      <div className="card">
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' }}>
            <FormInput
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={loading}
            />

            <FormInput
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <FormInput
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || isEditMode} // Lock email updates
          />

          {!isEditMode && (
            <FormInput
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          )}

          <FormSelect
            label="Security Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={roleOptions}
            disabled={loading}
          />

          {isEditMode && (
            <div className="form-group" style={{ flexDirection: 'row', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={loading}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="isActive" style={{ fontWeight: 500, fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}>
                Account Active
              </label>
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Link to="/users" className="btn btn-secondary">
              Cancel
            </Link>
            <FormButton type="submit" loading={loading}>
              {isEditMode ? 'Save Changes' : 'Create User'}
            </FormButton>
          </div>
        </form>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};
