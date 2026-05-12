import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import * as db from '../db';
import { Shield, User as UserIcon, CheckCircle2 } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const allUsers = await db.getAllUsers();
    setUsers(allUsers);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (user: User, newRole: 'admin' | 'user') => {
    if (user.username === 'admin') {
      alert("The default 'admin' user's role cannot be changed.");
      return;
    }
    if (window.confirm(`Are you sure you want to change ${user.username}'s role to ${newRole}?`)) {
      const updatedUser = { ...user, role: newRole };
      await db.updateUser(updatedUser);
      setSuccessMessage(`${user.username}'s role has been updated to ${newRole}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchUsers();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-lg border border-stone-200">
      <h2 className="text-3xl font-serif font-bold text-stone-900 mb-8 pb-4 border-b border-stone-200">
        User Management
      </h2>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center text-green-800">
          <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="space-y-3">
        {users.map(user => (
          <div key={user.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200">
            <div className="flex items-center">
              {user.role === 'admin' ? (
                <Shield className="w-6 h-6 text-slate-600 mr-3" />
              ) : (
                <UserIcon className="w-6 h-6 text-stone-500 mr-3" />
              )}
              <div>
                <p className="font-bold text-stone-800">{user.username}</p>
                <p className="text-sm text-stone-500">Role: {user.role}</p>
              </div>
            </div>
            {user.role === 'admin' ? (
              <button
                onClick={() => handleRoleChange(user, 'user')}
                className="px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 rounded-md hover:bg-yellow-200 transition-colors"
                disabled={user.username === 'admin'}
                title={user.username === 'admin' ? "Cannot demote default admin" : "Demote to User"}
              >
                Demote to User
              </button>
            ) : (
              <button
                onClick={() => handleRoleChange(user, 'admin')}
                className="px-3 py-1.5 text-sm font-medium text-green-800 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                title="Promote to Admin"
              >
                Promote to Admin
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
