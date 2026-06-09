import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { UserDto } from '../../types/user';
import { DataGrid } from '../../components/data/DataGrid';
import { HasPermission } from '../../components/guards/HasPermission';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { Toast } from '../../components/feedback/Toast';

export const UserListPage: React.FC = () => {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(false);

  // Dialog & Notification states
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'danger'>('success');

  const triggerToast = (msg: string, type: 'success' | 'danger' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await userApi.delete(deleteId);
      triggerToast('User soft-deleted successfully.');
      setRefresh((r) => !r);
    } catch (err: any) {
      triggerToast(err.response?.data?.message || 'Failed to delete user.', 'danger');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const columns = [
    {
      header: 'Name',
      key: 'name',
      render: (row: UserDto) => <strong>{row.firstName} {row.lastName}</strong>,
      sortable: false,
    },
    {
      header: 'Email Address',
      key: 'email',
      sortable: true,
    },
    {
      header: 'Account Status',
      key: 'accountStatus',
      render: (row: UserDto) => (
        <span
          className={`alert`}
          style={{
            display: 'inline-block',
            margin: 0,
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '12px',
            backgroundColor: row.isActive ? 'var(--success-light)' : 'var(--danger-light)',
            color: row.isActive ? 'var(--success-hover)' : 'var(--danger-hover)',
            border: 'none',
          }}
        >
          {row.accountStatus}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Roles',
      key: 'roles',
      render: (row: UserDto) => <span>{row.roles.join(', ')}</span>,
      sortable: false,
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row: UserDto) => (
        <div className="flex gap-2">
          {/* Rule 07 / UI1 Guard around actions */}
          <HasPermission permission="users.edit">
            <button className="btn btn-secondary" onClick={() => navigate(`/users/edit/${row.id}`)} style={{ padding: '4px 8px', fontSize: '12px' }}>
              Edit
            </button>
          </HasPermission>
          
          <HasPermission permission="users.delete">
            <button className="btn btn-danger" onClick={() => setDeleteId(row.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>
              Delete
            </button>
          </HasPermission>
        </div>
      ),
      sortable: false,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users Management</h1>
        <HasPermission permission="users.create">
          <button className="btn btn-primary" onClick={() => navigate('/users/new')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add New User
          </button>
        </HasPermission>
      </div>

      <div className="card">
        <DataGrid
          fetchData={userApi.getPaged}
          columns={columns}
          searchPlaceholder="Search users by name or email..."
          refreshTrigger={refresh}
        />
      </div>

      {/* Delete Confirmation Overlay (Rule 07 / UI6 / AL6) */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete User"
        message="Are you sure you want to delete this user? This will soft-delete their profile, hiding it from normal views."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        isLoading={deleting}
      />

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
