import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import PageHeader from './ui/PageHeader';

interface Company {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: any;
  memberCount?: number;
  userRole?: 'admin' | 'staff' | 'client';
}

interface CompanyManagementDashboardProps {
  onCreateCompany: (name: string) => Promise<string>;
  onJoinCompany: (companyId: string) => Promise<void>;
  onSelectCompany: (companyId: string) => void;
  userProfile?: any; // User profile to trigger reloads
}

const CompanyManagementDashboard: React.FC<CompanyManagementDashboardProps> = ({
  onCreateCompany,
  onJoinCompany,
  onSelectCompany,
  userProfile
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [joinCompanyId, setJoinCompanyId] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadUserCompanies();
  }, [currentUser, userProfile]);

  const loadUserCompanies = async () => {
    try {
      setLoading(true);
      
      if (!currentUser) {
        setCompanies([]);
        setLoading(false);
        return;
      }

      // Get all companies where user is a member
      const membershipsQuery = query(
        collection(db, 'companyMemberships'),
        where('userId', '==', currentUser.uid)
      );
      const membershipsSnapshot = await getDocs(membershipsQuery);
      
      const companyIds = membershipsSnapshot.docs.map(doc => doc.data().companyId);
      
      if (companyIds.length === 0) {
        setCompanies([]);
        setLoading(false);
        return;
      }
      
      // Get company details for each membership
      const companiesData: Company[] = [];
      for (const companyId of companyIds) {
        try {
          // Special case: Remove default-company memberships (legacy migration data)
          if (companyId === 'default-company') {
            try {
              await deleteDoc(doc(db, 'companyMemberships', `${currentUser.uid}_${companyId}`));
              continue; // Skip adding this company to the list
            } catch (deleteError) {
              console.error('Error removing legacy default-company membership:', deleteError);
            }
          }
          
          const companyDoc = await getDoc(doc(db, 'companies', companyId));
          if (companyDoc.exists()) {
            const companyData = companyDoc.data();
            const membership = membershipsSnapshot.docs.find(doc => doc.data().companyId === companyId);
            
            const role = membership?.data().role || 'client';
            
            companiesData.push({
              id: companyId,
              name: companyData.name,
              description: companyData.description,
              ownerId: companyData.ownerId,
              createdAt: companyData.createdAt,
              memberCount: companyData.memberCount,
              userRole: role
            });
          } else {
            // Company doesn't exist, remove the invalid membership
            try {
              await deleteDoc(doc(db, 'companyMemberships', `${currentUser.uid}_${companyId}`));
            } catch (deleteError) {
              console.error('Error removing invalid membership:', deleteError);
            }
          }
        } catch (error) {
          console.error('Error loading company:', companyId, error);
        }
      }
      
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error loading user companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || creating) return;
    
    try {
      setCreating(true);
      const companyId = await onCreateCompany(newCompanyName.trim());
      setNewCompanyName('');
      await loadUserCompanies(); // Refresh the list
    } catch (error) {
      console.error('Error creating company:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCompanyId.trim() || joining) return;
    
    try {
      setJoining(true);
      await onJoinCompany(joinCompanyId.trim());
      setJoinCompanyId('');
      await loadUserCompanies(); // Refresh the list
    } catch (error) {
      console.error('Error joining company:', error);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 text-sm mt-2">{t('company.loadingCompanies')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t('company.title')}
        subtitle="Manage your companies and access projects"
        className="text-center sm:text-left"
      />

      {/* Create Company Section */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('company.createNewCompany')}</h2>
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <Input
            id="companyName"
            label={t('company.companyName')}
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder={t('company.enterCompanyName')}
            required
          />
          <Button
            type="submit"
            disabled={creating || !newCompanyName.trim()}
            loading={creating}
            className="w-full"
          >
            {t('company.createCompanyAndBecomeAdmin')}
          </Button>
        </form>
      </Card>

      {/* Join Company Section */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('company.joinExistingCompany')}</h2>
        <form onSubmit={handleJoinCompany} className="space-y-4">
          <Input
            id="companyId"
            label={t('company.companyId')}
            value={joinCompanyId}
            onChange={(e) => setJoinCompanyId(e.target.value)}
            placeholder={t('company.enterCompanyId')}
            required
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={joining || !joinCompanyId.trim()}
            loading={joining}
            className="w-full"
          >
            {t('company.joinCompanyAsStaff')}
          </Button>
        </form>
      </Card>

      {/* User's Companies */}
      {companies.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('company.myCompanies')}</h2>
          <div className="space-y-3">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onSelectCompany(company.id)}
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-500">
                    Role: <span className="font-medium">
                      {(() => {
                        const cleanRole = String(company.userRole).replace(/[^a-zA-Z]/g, '').toLowerCase() || 'client';
                        // Force proper capitalization
                        if (cleanRole === 'admin') return 'Admin';
                        if (cleanRole === 'staff') return 'Staff';
                        if (cleanRole === 'client') return 'Client';
                        return 'Client';
                      })()}
                    </span>
                    {company.memberCount > 0 && (
                      <span className="ml-2">• {company.memberCount} members</span>
                    )}
                  </p>
                </div>
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {companies.length === 0 && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('company.noCompaniesYet')}</h3>
          <p className="text-gray-500 mb-4">{t('company.createOrJoinToGetStarted')}</p>
        </Card>
      )}
    </div>
  );
};

export default CompanyManagementDashboard;
