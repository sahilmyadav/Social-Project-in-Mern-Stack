'use client';

import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { authService } from '@/lib/api-services';
import {
  ArrowLeft,
  Bell,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// OTP Input Component
function OTPInput({
  length = 6,
  value,
  onChange,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const handleChange = (index: number, char: string) => {
    if (char.length > 1) {
      // Handle paste
      const pastedValue = char.slice(0, length).replace(/\D/g, '');
      onChange(pastedValue);
      return;
    }

    if (!/^\d*$/.test(char)) return; // Only allow digits

    const newValue = value.split('');
    newValue[index] = char;
    onChange(newValue.join(''));

    // Auto focus next input
    if (char && index < length - 1) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          id={`otp-${index}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text');
            handleChange(index, pastedData);
          }}
          className="w-12 h-12 text-center text-xl font-bold bg-muted border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        />
      ))}
    </div>
  );
}

export default function AccountSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingDOB, setIsEditingDOB] = useState(false);

  // OTP verification states
  const [showEmailOTP, setShowEmailOTP] = useState(false);
  const [showPhoneOTP, setShowPhoneOTP] = useState(false);
  const [emailOTP, setEmailOTP] = useState('');
  const [phoneOTP, setPhoneOTP] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Loading states
  const [nameLoading, setNameLoading] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [dobLoading, setDobLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle'
  );
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    promotions: false,
  });
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const router = useRouter();
  const { confirm, dialogProps } = useConfirmDialog();

  useEffect(() => {
    const loadUserData = async () => {
      const userData = localStorage.getItem('user');
      if (!userData) {
        router.push('/');
        return;
      }

      // First, set data from localStorage for quick display
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setFormData({
        firstName: parsedUser.firstName || '',
        lastName: parsedUser.lastName || '',
        username: parsedUser.username || '',
        email: parsedUser.email || '',
        phone: parsedUser.phone || parsedUser.phoneNumber || '',
        dateOfBirth: parsedUser.dateOfBirth || parsedUser.dob || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsPrivateAccount(parsedUser.profile_type === 'private' || parsedUser.isPrivate || false);
      setAllowDownloads(parsedUser.allowDownloads !== false);

      // Then fetch fresh data from server
      try {
        const response = await authService.getCurrentUser();
        if (response.success && response.data) {
          const freshUser = response.data;
          // Merge fresh data with existing data
          const updatedUser = { ...parsedUser, ...freshUser };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);

          // Format date of birth properly for input
          let dobValue = '';
          if (freshUser.dob) {
            const date = new Date(freshUser.dob);
            dobValue = date.toISOString().split('T')[0];
          } else if (freshUser.dateOfBirth) {
            const date = new Date(freshUser.dateOfBirth);
            dobValue = date.toISOString().split('T')[0];
          }

          setFormData((prev) => ({
            ...prev,
            firstName: freshUser.firstName || prev.firstName,
            lastName: freshUser.lastName || prev.lastName,
            username: freshUser.username || prev.username,
            email: freshUser.email || prev.email,
            phone: freshUser.phone || freshUser.phoneNumber || prev.phone,
            dateOfBirth: dobValue || prev.dateOfBirth,
          }));
          setIsPrivateAccount(freshUser.profile_type === 'private' || freshUser.isPrivate || false);
          setAllowDownloads(freshUser.allowDownloads !== false);
        }
      } catch (error) {
        console.error('Failed to fetch fresh user data:', error);
      }
    };

    loadUserData();
  }, [router]);

  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username === user?.username) {
      setUsernameStatus('idle');
      return;
    }

    if (username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');

    try {
      const response = await authService.checkUsername(username);
      if (response.success && response.data?.available) {
        setUsernameStatus('available');
      } else {
        setUsernameStatus('taken');
      }
    } catch (error) {
      setUsernameStatus('idle');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Check username availability with debounce
    if (name === 'username') {
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }
      const timeout = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
      setUsernameCheckTimeout(timeout);
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  // Save Name
  const handleSaveName = async () => {
    if (!formData.firstName.trim()) {
      confirm({
        title: 'Error',
        message: 'First name is required',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setNameLoading(true);
    try {
      const response = await authService.updateProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });

      if (response.success) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.firstName = formData.firstName.trim();
          parsedUser.lastName = formData.lastName.trim();
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        }
        setIsEditingName(false);
        confirm({
          title: 'Success',
          message: 'Name updated successfully!',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to update name',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Failed to update name',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setNameLoading(false);
    }
  };

  // Save Username
  const handleSaveUsername = async () => {
    if (!formData.username.trim() || formData.username.length < 3) {
      confirm({
        title: 'Error',
        message: 'Username must be at least 3 characters',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    if (usernameStatus === 'taken') {
      confirm({
        title: 'Error',
        message: 'This username is already taken',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setUsernameLoading(true);
    try {
      const response = await authService.updateProfile({
        username: formData.username.trim().toLowerCase(),
      });

      if (response.success) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.username = formData.username.trim().toLowerCase();
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        }
        setIsEditingUsername(false);
        setUsernameStatus('idle');
        confirm({
          title: 'Success',
          message: 'Username updated successfully!',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to update username',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Failed to update username',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setUsernameLoading(false);
    }
  };

  // Request Email Change OTP
  const handleRequestEmailChange = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      confirm({
        title: 'Error',
        message: 'Please enter a valid email address',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setEmailLoading(true);
    try {
      const response = await authService.requestEmailChange({ newEmail: newEmail.trim() });

      if (response.success) {
        setShowEmailOTP(true);
        confirm({
          title: 'OTP Sent',
          message: 'A verification code has been sent to your current email and phone number.',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to send verification code',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Failed to send verification code',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // Verify Email Change OTP
  const handleVerifyEmailOTP = async () => {
    if (emailOTP.length !== 6) {
      confirm({
        title: 'Error',
        message: 'Please enter the 6-digit verification code',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setOtpLoading(true);
    try {
      const response = await authService.verifyEmailChange({
        newEmail: newEmail.trim(),
        otp: emailOTP,
      });

      if (response.success) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.email = newEmail.trim();
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
          setFormData({ ...formData, email: newEmail.trim() });
        }
        setShowEmailOTP(false);
        setIsEditingEmail(false);
        setEmailOTP('');
        setNewEmail('');
        confirm({
          title: 'Success',
          message: 'Email updated successfully!',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Invalid verification code',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Invalid verification code',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setOtpLoading(false);
    }
  };

  // Request Phone Change OTP
  const handleRequestPhoneChange = async () => {
    if (!newPhone.trim() || newPhone.length < 10) {
      confirm({
        title: 'Error',
        message: 'Please enter a valid phone number',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setPhoneLoading(true);
    try {
      const response = await authService.requestPhoneChange({ newPhone: newPhone.trim() });

      if (response.success) {
        setShowPhoneOTP(true);
        confirm({
          title: 'OTP Sent',
          message: 'A verification code has been sent to your email and current phone number.',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to send verification code',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Failed to send verification code',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  // Verify Phone Change OTP
  const handleVerifyPhoneOTP = async () => {
    if (phoneOTP.length !== 6) {
      confirm({
        title: 'Error',
        message: 'Please enter the 6-digit verification code',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setOtpLoading(true);
    try {
      const response = await authService.verifyPhoneChange({
        newPhone: newPhone.trim(),
        otp: phoneOTP,
      });

      if (response.success) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.phone = newPhone.trim();
          parsedUser.phoneNumber = newPhone.trim();
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
          setFormData({ ...formData, phone: newPhone.trim() });
        }
        setShowPhoneOTP(false);
        setIsEditingPhone(false);
        setPhoneOTP('');
        setNewPhone('');
        confirm({
          title: 'Success',
          message: 'Phone number updated successfully!',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Invalid verification code',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Invalid verification code',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setOtpLoading(false);
    }
  };

  // Save Date of Birth
  const handleSaveDOB = async () => {
    if (!formData.dateOfBirth) {
      confirm({
        title: 'Error',
        message: 'Please select your date of birth',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
      return;
    }

    setDobLoading(true);
    try {
      const response = await authService.updateProfile({
        dateOfBirth: formData.dateOfBirth,
      });

      if (response.success) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.dateOfBirth = formData.dateOfBirth;
          parsedUser.dob = formData.dateOfBirth;
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        }
        setIsEditingDOB(false);
        confirm({
          title: 'Success',
          message: 'Date of birth updated successfully!',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to update date of birth',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      confirm({
        title: 'Error',
        message: error.message || 'Failed to update date of birth',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setDobLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (formData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await authService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      if (response.success) {
        confirm({
          title: 'Success',
          message: 'Password changed successfully!',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        setPasswordError(response.message || 'Failed to change password');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleTogglePrivateAccount = async () => {
    setPrivacyLoading(true);
    try {
      const newPrivacyStatus = !isPrivateAccount;

      const response = await authService.updatePrivacySettings({
        profile_type: newPrivacyStatus ? 'private' : 'public',
      });

      if (response.success) {
        setIsPrivateAccount(newPrivacyStatus);

        // Update user data in localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.profile_type = newPrivacyStatus ? 'private' : 'public';
          parsedUser.isPrivate = newPrivacyStatus;
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        }

        confirm({
          title: 'Privacy Settings Updated',
          message: newPrivacyStatus ? 'Your account is now private' : 'Your account is now public',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to update privacy settings',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      console.error('Error updating privacy:', error);
      confirm({
        title: 'Error',
        message: error.message || 'Failed to update privacy settings',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleToggleDownloads = async () => {
    setDownloadLoading(true);
    try {
      const newDownloadStatus = !allowDownloads;

      const response = await authService.updatePrivacySettings({
        allowDownloads: newDownloadStatus,
      });

      if (response.success) {
        setAllowDownloads(newDownloadStatus);

        // Update user data in localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.allowDownloads = newDownloadStatus;
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        }

        confirm({
          title: 'Download Settings Updated',
          message: newDownloadStatus
            ? 'Others can now download your posts and reels'
            : 'Others cannot download your posts and reels',
          variant: 'success',
          confirmText: 'OK',
          cancelText: null,
        });
      } else {
        confirm({
          title: 'Error',
          message: response.message || 'Failed to update download settings',
          variant: 'danger',
          confirmText: 'OK',
          cancelText: null,
        });
      }
    } catch (error: any) {
      console.error('Error updating download settings:', error);
      confirm({
        title: 'Error',
        message: error.message || 'Failed to update download settings',
        variant: 'danger',
        confirmText: 'OK',
        cancelText: null,
      });
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    confirm({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete Account',
      onConfirm: () => {
        localStorage.removeItem('user');
        router.push('/');
      },
    });
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <ConfirmDialog {...dialogProps} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto cursor-pointer">
          <Navigation user={user} onLogout={() => {}} />
        </aside>

        <section className="lg:col-span-3">
          <div className="max-w-3xl mx-auto p-4 lg:p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-muted rounded-lg transition cursor-pointer"
              >
                <ArrowLeft size={24} className="text-foreground" />
              </button>
              <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-border overflow-x-auto pb-px scrollbar-hide">
              {[
                { id: 'general', label: 'General', icon: '⚙️' },
                { id: 'security', label: 'Security', icon: '🔒' },
                { id: 'notifications', label: 'Notifications', icon: '🔔' },
                { id: 'privacy', label: 'Privacy', icon: '🛡️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Profile Info Card - Instagram Style */}
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  {/* Card Header */}
                  <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">Profile Information</h2>
                  </div>

                  {/* Fields List */}
                  <div className="divide-y divide-border">
                    {/* Name Field */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm text-muted-foreground mb-1">Name</p>
                          {isEditingName ? (
                            <div className="flex gap-2 mt-2">
                              <Input
                                type="text"
                                name="firstName"
                                placeholder="First name"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                className="h-9 text-sm"
                              />
                              <Input
                                type="text"
                                name="lastName"
                                placeholder="Last name"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                className="h-9 text-sm"
                              />
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-foreground">
                              {user?.firstName || user?.lastName
                                ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                                : 'Add name'}
                            </p>
                          )}
                        </div>
                        {!isEditingName ? (
                          <button
                            onClick={() => setIsEditingName(true)}
                            className="text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setIsEditingName(false);
                                setFormData({
                                  ...formData,
                                  firstName: user?.firstName || '',
                                  lastName: user?.lastName || '',
                                });
                              }}
                              className="text-sm text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveName}
                              disabled={nameLoading}
                              className="text-sm font-semibold text-primary hover:text-primary/80 disabled:opacity-50 flex items-center gap-1"
                            >
                              {nameLoading && <Loader2 size={14} className="animate-spin" />}
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Username Field */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm text-muted-foreground mb-1">Username</p>
                          {isEditingUsername ? (
                            <div className="mt-2 space-y-1.5">
                              <div className="relative max-w-xs">
                                <Input
                                  type="text"
                                  name="username"
                                  placeholder="username"
                                  value={formData.username}
                                  onChange={handleInputChange}
                                  className="h-9 text-sm pr-8"
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                  {usernameStatus === 'checking' && (
                                    <Loader2
                                      size={14}
                                      className="animate-spin text-muted-foreground"
                                    />
                                  )}
                                  {usernameStatus === 'available' && (
                                    <Check size={14} className="text-green-500" />
                                  )}
                                  {usernameStatus === 'taken' && (
                                    <X size={14} className="text-red-500" />
                                  )}
                                </div>
                              </div>
                              {usernameStatus === 'taken' && (
                                <p className="text-xs text-red-500">Username not available</p>
                              )}
                              {usernameStatus === 'available' && (
                                <p className="text-xs text-green-500">Username is available</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-foreground">
                              @{user?.username || 'username'}
                            </p>
                          )}
                        </div>
                        {!isEditingUsername ? (
                          <button
                            onClick={() => setIsEditingUsername(true)}
                            className="text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setIsEditingUsername(false);
                                setFormData({ ...formData, username: user?.username || '' });
                                setUsernameStatus('idle');
                              }}
                              className="text-sm text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveUsername}
                              disabled={usernameLoading || usernameStatus === 'taken'}
                              className="text-sm font-semibold text-primary hover:text-primary/80 disabled:opacity-50 flex items-center gap-1"
                            >
                              {usernameLoading && <Loader2 size={14} className="animate-spin" />}
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Email Field */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm text-muted-foreground mb-1">Email</p>
                          {isEditingEmail ? (
                            <div className="mt-2 space-y-3 max-w-sm">
                              <p className="text-xs text-muted-foreground">
                                Current email: {formData.email}
                              </p>
                              <Input
                                type="email"
                                placeholder="New email address"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="h-9 text-sm"
                                disabled={showEmailOTP}
                              />
                              {showEmailOTP ? (
                                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                                  <p className="text-xs text-muted-foreground text-center">
                                    Enter the 6-digit code sent to your email
                                  </p>
                                  <OTPInput value={emailOTP} onChange={setEmailOTP} />
                                  <Button
                                    onClick={handleVerifyEmailOTP}
                                    disabled={otpLoading || emailOTP.length !== 6}
                                    size="sm"
                                    className="w-full"
                                  >
                                    {otpLoading && (
                                      <Loader2 size={14} className="animate-spin mr-2" />
                                    )}
                                    Verify
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={handleRequestEmailChange}
                                  disabled={emailLoading || !newEmail}
                                  size="sm"
                                  variant="outline"
                                >
                                  {emailLoading && (
                                    <Loader2 size={14} className="animate-spin mr-2" />
                                  )}
                                  Send verification code
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-foreground">{formData.email}</p>
                          )}
                        </div>
                        {!isEditingEmail ? (
                          <button
                            onClick={() => setIsEditingEmail(true)}
                            className="text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            Change
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setIsEditingEmail(false);
                              setShowEmailOTP(false);
                              setEmailOTP('');
                              setNewEmail('');
                            }}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Phone Field */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm text-muted-foreground mb-1">Phone number</p>
                          {isEditingPhone ? (
                            <div className="mt-2 space-y-3 max-w-sm">
                              {formData.phone && (
                                <p className="text-xs text-muted-foreground">
                                  Current: {formData.phone}
                                </p>
                              )}
                              <Input
                                type="tel"
                                placeholder="Phone number"
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                className="h-9 text-sm"
                                disabled={showPhoneOTP}
                              />
                              {showPhoneOTP ? (
                                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                                  <p className="text-xs text-muted-foreground text-center">
                                    Enter the 6-digit code to verify
                                  </p>
                                  <OTPInput value={phoneOTP} onChange={setPhoneOTP} />
                                  <Button
                                    onClick={handleVerifyPhoneOTP}
                                    disabled={otpLoading || phoneOTP.length !== 6}
                                    size="sm"
                                    className="w-full"
                                  >
                                    {otpLoading && (
                                      <Loader2 size={14} className="animate-spin mr-2" />
                                    )}
                                    Verify
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={handleRequestPhoneChange}
                                  disabled={phoneLoading || !newPhone}
                                  size="sm"
                                  variant="outline"
                                >
                                  {phoneLoading && (
                                    <Loader2 size={14} className="animate-spin mr-2" />
                                  )}
                                  Send verification code
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-foreground">
                              {formData.phone || (
                                <span className="text-muted-foreground">Add phone number</span>
                              )}
                            </p>
                          )}
                        </div>
                        {!isEditingPhone ? (
                          <button
                            onClick={() => setIsEditingPhone(true)}
                            className="text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            {formData.phone ? 'Change' : 'Add'}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setIsEditingPhone(false);
                              setShowPhoneOTP(false);
                              setPhoneOTP('');
                              setNewPhone('');
                            }}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Date of Birth Field */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm text-muted-foreground">Birthday</p>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              Only visible to you
                            </span>
                          </div>
                          {isEditingDOB ? (
                            <div className="mt-2 max-w-xs">
                              <Input
                                type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleInputChange}
                                max={new Date().toISOString().split('T')[0]}
                                className="h-9 text-sm"
                              />
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-foreground">
                              {formData.dateOfBirth ? (
                                formatDate(formData.dateOfBirth)
                              ) : (
                                <span className="text-muted-foreground">Add birthday</span>
                              )}
                            </p>
                          )}
                        </div>
                        {!isEditingDOB ? (
                          <button
                            onClick={() => setIsEditingDOB(true)}
                            className="text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            {formData.dateOfBirth ? 'Edit' : 'Add'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setIsEditingDOB(false);
                                setFormData({
                                  ...formData,
                                  dateOfBirth: user?.dateOfBirth || user?.dob || '',
                                });
                              }}
                              className="text-sm text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveDOB}
                              disabled={dobLoading}
                              className="text-sm font-semibold text-primary hover:text-primary/80 disabled:opacity-50 flex items-center gap-1"
                            >
                              {dobLoading && <Loader2 size={14} className="animate-spin" />}
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock size={24} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Change Password</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleInputChange}
                          className="bg-muted border-0 text-foreground pr-10"
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleInputChange}
                          className="bg-muted border-0 text-foreground pr-10"
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className="bg-muted border-0 text-foreground pr-10"
                        />
                        <button
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mt-4">
                        {passwordError}
                      </div>
                    )}

                    <Button
                      onClick={handleChangePassword}
                      disabled={passwordLoading}
                      className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground w-full mt-6"
                    >
                      {passwordLoading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield size={24} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Two-Factor Authentication</h2>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <Button className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground">
                    Enable 2FA
                  </Button>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Bell size={24} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
                  </div>

                  <div className="space-y-4">
                    {(
                      [
                        { key: 'likes', label: 'Likes on your posts', icon: '❤️' },
                        { key: 'comments', label: 'Comments on your posts', icon: '💬' },
                      ] as const
                    ).map((notif) => (
                      <div
                        key={notif.key}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">{notif.icon}</span>
                          <span className="text-foreground font-semibold">{notif.label}</span>
                        </div>
                        <button
                          onClick={() => handleNotificationChange(notif.key)}
                          className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${
                            notifications[notif.key as keyof typeof notifications]
                              ? 'bg-primary'
                              : 'bg-muted-foreground'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition transform ${
                              notifications[notif.key as keyof typeof notifications]
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <h2 className="text-xl font-bold mb-4 text-foreground">Privacy & Safety</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Private Account</p>
                        <p className="text-sm text-muted-foreground">
                          {isPrivateAccount
                            ? 'Your account is private - only approved followers can see your posts'
                            : 'Your account is public - anyone can see your posts'}
                        </p>
                      </div>
                      <button
                        onClick={handleTogglePrivateAccount}
                        disabled={privacyLoading}
                        className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${
                          isPrivateAccount ? 'bg-primary' : 'bg-muted-foreground'
                        } disabled:opacity-50`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition transform ${
                            isPrivateAccount ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Allow Downloads</p>
                        <p className="text-sm text-muted-foreground">
                          {allowDownloads
                            ? 'Others can download your posts and reels'
                            : 'Others cannot download your posts and reels'}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleDownloads}
                        disabled={downloadLoading}
                        className={`cursor-pointer w-12 h-7 rounded-full transition flex-shrink-0 ${
                          allowDownloads ? 'bg-primary' : 'bg-muted-foreground'
                        } disabled:opacity-50`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition transform ${
                            allowDownloads ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">
                          Block Messages from Strangers
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Only people you follow can message you
                        </p>
                      </div>
                      <button className="cursor-pointer w-12 h-7 rounded-full bg-primary flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-white translate-x-6" />
                      </button>
                    </div>

                    {/* Blocked Users */}
                    <button
                      onClick={() => router.push('/blocked-users')}
                      className="w-full flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition cursor-pointer"
                    >
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Blocked Users</p>
                        <p className="text-sm text-muted-foreground">Manage users you've blocked</p>
                      </div>
                      <span className="text-muted-foreground">→</span>
                    </button>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-red-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Trash2 size={24} className="text-red-500" />
                    <h2 className="text-xl font-bold text-red-500">Delete Account</h2>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button
                    onClick={handleDeleteAccount}
                    className="bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                  >
                    Delete Account Permanently
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Navigation user={user} onLogout={() => {}} isMobile={true} />
    </main>
  );
}
