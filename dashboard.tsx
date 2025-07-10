import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError, isBannedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { SurveyModal } from "@/components/survey-modal";
import { WithdrawalPanel } from "@/components/withdrawal-panel";
import { OfferwallSections, type OfferwallOffer } from "@/components/offerwall-sections";
import { OfferwallIframe } from "@/components/offerwall-iframe";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [showOfferwallDialog, setShowOfferwallDialog] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/auth/google";
      }, 500);
      return;
    }
  }, [user, isLoading, toast]);

  // Check if user is banned
  useEffect(() => {
    if (user && user.status === "banned") {
      toast({
        title: "Account Banned",
        description: "This account has been banned. Please contact support.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Fetch surveys
  const { data: surveys = [], isLoading: surveysLoading } = useQuery({
    queryKey: ["/api/surveys"],
    enabled: !!user && user.status !== "banned",
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: !!user && user.status !== "banned",
  });

  // Fetch pending withdrawal
  const { data: pendingWithdrawal } = useQuery({
    queryKey: ["/api/withdrawals/pending"],
    enabled: !!user && user.status !== "banned",
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleStartSurvey = (survey: any) => {
    setSelectedSurvey(survey);
  };

  const handleSurveyComplete = () => {
    setSelectedSurvey(null);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
  };

  const handleOfferwallComplete = async (offer: OfferwallOffer, reward: number) => {
    try {
      await apiRequest("POST", "/api/offerwall/complete", {
        offerId: offer.id,
        provider: offer.provider,
        reward: reward,
        title: offer.title
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      toast({
        title: "Offer Completed!",
        description: `You earned ${reward} gems from ${offer.title}`,
      });
    } catch (error: any) {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/auth/google";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to complete offer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOfferwallEarnings = async (amount: number) => {
    try {
      await apiRequest("POST", "/api/offerwall/earnings", {
        amount: amount,
        description: "Offerwall earnings"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      toast({
        title: "Gems Earned!",
        description: `You earned ${amount} gems!`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process earnings.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show ban message
  if (user.status === "banned") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 text-4xl mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 008.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Account Banned</h2>
            <p className="text-gray-600 mb-6">This account has been banned. Please contact support.</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700">
                <strong>Support Email:</strong> 5minutessurvey@gmail.com
              </p>
            </div>
            <Button onClick={handleLogout} className="bg-primary hover:bg-primary/90">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate stats
  const completedSurveys = transactions.filter((t: any) => t.type === "survey_reward").length;
  const completedOffers = transactions.filter((t: any) => t.type === "offerwall_reward").length;
  const totalEarned = (user.gemBalance * 0.001).toFixed(2); // Convert gems to dollars (1000 gems = $1)
  const avgTime = 4.2; // Static for now

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo />
            
            <div className="flex items-center space-x-4">
              {/* Gem Balance */}
              <div className="flex items-center bg-secondary/10 px-3 py-2 rounded-full">
                <svg className="w-4 h-4 text-secondary mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                <span className="font-semibold text-gray-800">{user.gemBalance}</span>
                <span className="text-sm text-gray-600 ml-1">gems</span>
              </div>
              
              {/* User Profile */}
              <div className="flex items-center space-x-2">
                <img 
                  src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.firstName}&background=1976D2&color=fff`}
                  alt="User profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-gray-700">
                  {user.firstName || user.email}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.firstName || "there"}!
          </h1>
          <p className="text-gray-600">Complete surveys and earn gems that convert to real cryptocurrency.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Gems</p>
                  <p className="text-2xl font-bold text-gray-900">{user.gemBalance}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <svg className="w-6 h-6 text-secondary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Surveys Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{completedSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Earned</p>
                  <p className="text-2xl font-bold text-gray-900">${totalEarned}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Time</p>
                  <p className="text-2xl font-bold text-gray-900">{avgTime}</p>
                  <p className="text-xs text-gray-500">minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Available Surveys */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Available Surveys</CardTitle>
                <p className="text-sm text-gray-600">Complete surveys to earn gems</p>
              </CardHeader>
              <CardContent>
                {surveysLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : surveys.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No surveys available at the moment.</p>
                ) : (
                  <div className="space-y-4">
                    {surveys.map((survey: any) => (
                      <div
                        key={survey.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleStartSurvey(survey)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-2">{survey.title}</h3>
                            <p className="text-sm text-gray-600 mb-3">{survey.description}</p>
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="flex items-center text-gray-500">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                {survey.duration} minutes
                              </span>
                              <span className="flex items-center text-gray-500">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                </svg>
                                {survey.participantCount} participants
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-secondary/10 text-secondary mb-2">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                              </svg>
                              {survey.reward}
                            </Badge>
                            <div>
                              <Button variant="ghost" size="sm" className="text-primary">
                                Start Survey
                                <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <WithdrawalPanel 
              user={user} 
              pendingWithdrawal={pendingWithdrawal}
              onWithdrawalSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/pending"] });
                queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
              }}
            />

            {/* Quick Offerwalls Button */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Offerwalls</CardTitle>
                <p className="text-sm text-gray-600">Multiple earning opportunities</p>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setShowOfferwallDialog(true)}
                  className="w-full"
                >
                  Open Offerwalls
                </Button>
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <p>• CPX Research - Surveys</p>
                  <p>• BitLabs - Games & Offers</p>
                  <p>• TheoremReach - Mobile surveys</p>
                  <p>• AdGem - Games & Videos</p>
                  <p>• Lootably - Video offers</p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((transaction: any) => (
                      <div key={transaction.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-full mr-3 ${
                            transaction.amount > 0 ? 'bg-secondary/10' : 'bg-primary/10'
                          }`}>
                            <svg className={`w-3 h-3 ${
                              transaction.amount > 0 ? 'text-secondary' : 'text-primary'
                            }`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d={
                                transaction.amount > 0 
                                  ? "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                                  : "M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                              } clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-medium ${
                          transaction.amount > 0 ? 'text-secondary' : 'text-primary'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount} gems
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Animated Scrolling Sections */}
        <div className="mt-12">
          <OfferwallSections onOfferComplete={handleOfferwallComplete} />
        </div>
      </main>

      {/* Modals */}
      {selectedSurvey && (
        <SurveyModal
          survey={selectedSurvey}
          onClose={() => setSelectedSurvey(null)}
          onComplete={handleSurveyComplete}
        />
      )}

      {showOfferwallDialog && (
        <OfferwallIframe
          onClose={() => setShowOfferwallDialog(false)}
          onEarningsUpdate={handleOfferwallEarnings}
        />
      )}
    </div>
  );
}
