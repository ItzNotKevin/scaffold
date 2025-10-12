import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
// Define UserRole type locally
type UserRole = 'admin' | 'staff';

const AuthPage: React.FC = () => {
  const { t } = useTranslation();
  const { languageKey } = useLanguage();
  
  // Force re-initialization of useTranslation when language changes
  const translationKey = `auth-${languageKey}`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
        if (isSignUp) {
          await signup(email, password, displayName, 'staff', companyId || undefined);
        } else {
          await login(email, password);
        }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    try {
      await resetPassword(email);
      setError('Password reset email sent!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div key={languageKey} className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8 px-safe">
      <div className="max-w-sm w-full">
        <Card>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignUp ? t('auth.createAccount') : t('auth.login')}
            </h2>
            <p className="text-gray-600 text-sm">
              {isSignUp ? t('auth.signupDescription') : t('auth.loginDescription')}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <Input
                  id="displayName"
                  label={t('auth.displayName')}
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('auth.displayName')}
                />
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">How Roles Work</h4>
                      <ul className="text-xs text-blue-800 mt-1 space-y-1">
                        <li>• <strong>Create a company:</strong> You become the admin</li>
                        <li>• <strong>Join a company:</strong> You become staff</li>
                        <li>• <strong>New accounts:</strong> Start as staff by default</li>
                        <li>• <strong>Permissions:</strong> Admins can promote staff to admin role</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <Input
                  id="companyId"
                  label="Company ID (Optional)"
                  type="text"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="Enter company ID if you have one"
                  helperText="If you don't have a company ID, leave this blank and an admin can add you later."
                />
              </>
            )}

            <Input
              id="email"
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
              required
            />

            <Input
              id="password"
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
              required
            />

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="w-full"
            >
              {isSignUp ? t('auth.signup') : t('auth.login')}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="outline"
              className="mt-4 w-full"
            >
              {t('auth.loginWithGoogle')}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Button
              onClick={() => setIsSignUp(!isSignUp)}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
            </Button>
          </div>

          {!isSignUp && (
            <div className="mt-4 text-center">
              <Button
                onClick={handleResetPassword}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-700"
              >
                {t('auth.forgotPassword')}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;


