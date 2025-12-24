import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { updateProfile, updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { compressImage } from '../lib/imageCompression';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import { useNavigate } from 'react-router-dom';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, userProfile, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compressProfilePicture, setCompressProfilePicture] = useState(true);
  const [profileLoadingTimeout, setProfileLoadingTimeout] = useState(false);
  
  // Profile form state
  const [displayName, setDisplayName] = useState(userProfile?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [profilePicture, setProfilePicture] = useState(userProfile?.profilePicture || '');

  // Update form state when userProfile changes
  React.useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.name || '');
      setEmail(userProfile.email || '');
      setProfilePicture(userProfile.profilePicture || '');
    }
  }, [userProfile]);

  // Timeout effect to detect if profile is taking too long to load
  React.useEffect(() => {
    if (currentUser && !userProfile) {
      const timeout = setTimeout(() => {
        console.log('ProfilePage: Profile loading timeout - taking too long');
        setProfileLoadingTimeout(true);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [currentUser, userProfile]);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setError(t('profile.invalidFile'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError(t('profile.fileTooLarge'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Delete old profile picture if exists
      if (userProfile?.profilePicture) {
        try {
          const oldImageRef = ref(storage, userProfile.profilePicture);
          await deleteObject(oldImageRef);
        } catch (deleteError) {
          console.log('Old image not found or already deleted');
        }
      }

      // Compress image if option is enabled
      let fileToUpload = file;
      if (compressProfilePicture && file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }
      
      // Upload new image
      const imageRef = ref(storage, `profile-pictures/${currentUser.uid}/${Date.now()}`);
      const snapshot = await uploadBytes(imageRef, fileToUpload);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update user profile in Firestore
      if (updateUserProfile) {
        await updateUserProfile({
          ...userProfile,
          profilePicture: downloadURL
        });
      }

      setProfilePicture(downloadURL);
      setSuccess(t('profile.pictureUpdated'));
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError(t('profile.pictureError'));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !updateUserProfile) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: displayName
      });

      // Update email if changed
      if (email !== currentUser.email) {
        await updateEmail(currentUser, email);
      }

      // Update Firestore user profile
      await updateUserProfile({
        ...userProfile,
        name: displayName,
        email: email
      });

      setSuccess(t('profile.profileUpdated'));
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('profile.passwordTooShort'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      setSuccess(t('profile.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        setError(t('profile.wrongPassword'));
      } else if (error.code === 'auth/weak-password') {
        setError(t('profile.weakPassword'));
      } else {
        setError(error.message || t('profile.passwordError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!currentUser || !userProfile?.profilePicture) return;

    setLoading(true);
    setError('');

    try {
      // Delete image from Storage
      const imageRef = ref(storage, userProfile.profilePicture);
      await deleteObject(imageRef);

      // Update user profile
      if (updateUserProfile) {
        await updateUserProfile({
          ...userProfile,
          profilePicture: ''
        });
      }

      setProfilePicture('');
      setSuccess(t('profile.pictureRemoved'));
    } catch (error: any) {
      console.error('Error removing profile picture:', error);
      setError(t('profile.pictureError'));
    } finally {
      setLoading(false);
    }
  };


  // Debug logging
  console.log('ProfilePage Debug:', {
    currentUser: !!currentUser,
    userProfile: !!userProfile,
    loading,
    userProfileData: userProfile
  });

  if (!currentUser || !userProfile) {
    return (
      <Layout title={t('profile.title')} onMenuClick={() => navigate('/')} currentRole={undefined}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 text-sm mt-2">
            {!currentUser ? 'Loading user...' : 'Loading profile...'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Debug: currentUser={!!currentUser}, userProfile={!!userProfile}
          </p>
          {profileLoadingTimeout && (
            <p className="text-xs text-red-500 mt-2">
              Profile loading is taking longer than expected. Please try refreshing the page.
            </p>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t('profile.title')} onMenuClick={() => navigate('/')} currentRole={undefined}>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <PageHeader
          title={t('profile.title')}
          subtitle={t('profile.subtitle')}
        />

        {error && (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm text-red-600">{error}</p>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <p className="text-sm text-green-600">{success}</p>
          </Card>
        )}

        {/* Profile Picture Section */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.profilePicture')}</h2>
          <div className="flex items-center space-x-4">
            <div className="relative">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                  <span className="text-2xl text-gray-500">
                    {(userProfile.name || userProfile.email).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={compressProfilePicture}
                  onChange={(e) => setCompressProfilePicture(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Compress image (faster upload, smaller file)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                loading={loading}
              >
                {profilePicture ? t('profile.changePicture') : t('profile.uploadPicture')}
              </Button>
              {profilePicture && (
                <Button
                  onClick={handleRemoveProfilePicture}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  {t('profile.removePicture')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Profile Information Section */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.personalInfo')}</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <Input
              id="displayName"
              label={t('profile.displayName')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profile.enterDisplayName')}
              required
            />
            <Input
              id="email"
              label={t('profile.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('profile.enterEmail')}
              required
            />
            <Button
              type="submit"
              loading={loading}
              className="w-full sm:w-auto"
            >
              {t('profile.updateProfile')}
            </Button>
          </form>
        </Card>

        {/* Password Change Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.password')}</h2>
            <Button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              variant="outline"
              size="sm"
            >
              {showPasswordForm ? t('profile.cancel') : t('profile.changePassword')}
            </Button>
          </div>
          
          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input
                id="currentPassword"
                label={t('profile.currentPassword')}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('profile.enterCurrentPassword')}
                required
              />
              <Input
                id="newPassword"
                label={t('profile.newPassword')}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('profile.enterNewPassword')}
                required
              />
              <Input
                id="confirmPassword"
                label={t('profile.confirmPassword')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('profile.confirmNewPassword')}
                required
              />
              <div className="flex space-x-3">
                <Button
                  type="submit"
                  loading={loading}
                  className="flex-1"
                >
                  {t('profile.updatePassword')}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  {t('profile.cancel')}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default ProfilePage;
