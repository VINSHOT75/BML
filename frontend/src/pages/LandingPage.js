import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage, languageNames } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import ChatBox from '../components/ChatBox';
import { 
  Truck, 
  MapPin, 
  Users, 
  BarChart3, 
  ArrowRight,
  CheckCircle2,
  Warehouse,
  Package,
  Handshake,
  Phone,
  Mail,
  MapPinned,
  Globe,
  CreditCard,
  Headphones,
  Shield,
  Clock,
  ChevronDown,
} from 'lucide-react';

// Company Contact Info
const CONTACT = {
  indiaPhone: '+91 91111-11185',
  australiaPhone: '+61 4111-85967',
  email: 'help.bookmyload@gmail.com',
  address: '211-214 Mechanic Nagar, Transport Nagar Indore, Madhya Pradesh 452001',
};

export default function LandingPage() {
  const { login, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const stats = [
    { value: '500+', label: t('warehouses') },
    { value: '2000+', label: t('transporters') },
    { value: '10K+', label: t('loadsDelivered') },
    { value: '24/7', label: t('support') }
  ];

  const warehouseFeatures = [
    t('warehouseFeature1') || 'No driver management headaches',
    t('warehouseFeature2') || 'Transparent pricing & billing',
    t('warehouseFeature3') || 'Real-time shipment tracking',
    t('warehouseFeature4') || 'Dedicated logistics support',
  ];

  const transporterFeatures = [
    t('transporterFeature1') || 'Consistent load availability',
    t('transporterFeature2') || 'Clear rates upfront',
    t('transporterFeature3') || 'Faster payments guaranteed',
    t('transporterFeature4') || 'No payment chasing',
  ];

  const features = [
    {
      icon: Warehouse,
      title: t('featureWarehouse') || 'Warehouse Connect',
      description: t('featureWarehouseDesc') || 'Connect with our managed transporter network. No marketplace chaos - just reliable service.'
    },
    {
      icon: Truck,
      title: t('featureTransporter') || 'Transporter Network',
      description: t('featureTransporterDesc') || 'Join our verified network. Get regular loads, clear rates, and timely payments.'
    },
    {
      icon: MapPin,
      title: t('featureTracking') || 'Live Tracking',
      description: t('featureTrackingDesc') || 'Real-time GPS tracking of all shipments from pickup to delivery.'
    },
    {
      icon: CreditCard,
      title: t('featurePayments') || 'Fast Payments',
      description: t('featurePaymentsDesc') || 'Transparent billing for warehouses. Quick payments for transporters.'
    },
    {
      icon: Headphones,
      title: t('featureSupport') || '24/7 Support',
      description: t('featureSupportDesc') || 'Dedicated support team in India and Australia to help you anytime.'
    },
    {
      icon: BarChart3,
      title: t('featureAnalytics') || 'Smart Analytics',
      description: t('featureAnalyticsDesc') || 'AI-powered insights for route optimization and cost efficiency.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between">
            <img 
              src="/logo.svg"
              alt="BookMyLoad - Connecting Loads, Delivering Solutions"
              className="w-56 sm:w-72 md:w-80 lg:w-96 object-contain"
            />
            <nav className="hidden lg:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
                {t('features')}
              </a>
              <a href="#about" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
                {t('aboutUs')}
              </a>
              <a href="#contact" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
                {t('contact')}
              </a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1 sm:gap-2 border-slate-300 px-2 sm:px-3">
                    <Globe className="w-4 h-4" />
                    <span className="hidden sm:inline">{languageNames[language]}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-slate-200">
                  {Object.entries(languageNames).map(([code, name]) => (
                    <DropdownMenuItem
                      key={code}
                      onClick={() => setLanguage(code)}
                      className={`cursor-pointer ${language === code ? 'bg-orange-50 text-[#E86F2A]' : ''}`}
                    >
                      {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {user ? (
                <Link to="/dashboard">
                  <Button size="sm" className="bg-[#E86F2A] hover:bg-[#d65f1a] text-white font-heading font-bold uppercase tracking-wide text-xs sm:text-sm px-2 sm:px-4">
                    <span className="hidden sm:inline">{t('dashboard')}</span>
                    <span className="sm:hidden">Dashboard</span>
                    <ArrowRight className="ml-1 sm:ml-2 w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </Link>
              ) : (
                <Button 
                  onClick={login}
                  size="sm"
                  data-testid="login-btn"
                  className="bg-[#E86F2A] hover:bg-[#d65f1a] text-white font-heading font-bold uppercase tracking-wide shadow-lg shadow-orange-500/20 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <span className="hidden sm:inline">{t('getStarted')}</span>
                  <span className="sm:hidden">Start</span>
                  <ArrowRight className="ml-1 sm:ml-2 w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-36 pb-20 overflow-hidden">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1709735133497-bbead76953a9?crop=entropy&cs=srgb&fm=jpg&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B4B7A]/95 via-[#1B4B7A]/80 to-[#1B4B7A]/60" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#E86F2A]/10 border border-[#E86F2A]/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-[#E86F2A] rounded-full animate-pulse" />
              <span className="text-[#E86F2A] text-sm font-medium">India's #1 Load Management Platform</span>
            </div>
            
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
              Connecting Loads, Delivering Solutions
            </h1>
            
            {/* Key Message Banner */}
            <div className="bg-[#E86F2A] text-white px-6 py-3 rounded-lg mb-6 inline-block">
              <p className="font-heading font-bold text-lg">
                BookMyLoad is not a marketplace. We MANAGE your transport.
              </p>
            </div>
            
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              BookMyLoad bridges warehouses and transporters across India. We MANAGE your transport - not just match loads. Get reliable logistics without the hassle.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={login}
                data-testid="hero-cta-btn"
                size="lg"
                className="bg-[#E86F2A] hover:bg-[#d65f1a] text-white font-heading font-bold uppercase tracking-wide shadow-lg shadow-orange-500/30 px-8"
              >
                Post Your Load
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                onClick={login}
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 font-heading font-semibold"
              >
                Find Loads
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-[#1B4B7A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="font-heading font-bold text-3xl sm:text-4xl text-[#E86F2A] mb-1">
                  {stat.value}
                </div>
                <div className="text-slate-300 text-sm font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Warehouses & Transporters Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* For Warehouses */}
            <div className="bg-gradient-to-br from-[#1B4B7A] to-[#0f2d4a] rounded-2xl p-8 text-white">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                <Warehouse className="w-7 h-7 text-[#E86F2A]" />
              </div>
              <h3 className="font-heading font-bold text-2xl mb-4">{t('forWarehouses')}</h3>
              <p className="text-xl text-white/90 mb-6 leading-relaxed">
                "{t('warehousePitch')}"
              </p>
              <ul className="space-y-3">
                {warehouseFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#E86F2A] flex-shrink-0" />
                    <span className="text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={login}
                className="mt-8 bg-[#E86F2A] hover:bg-[#d65f1a] text-white font-heading font-semibold"
              >
                {t('postYourLoad')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            {/* For Transporters */}
            <div className="bg-gradient-to-br from-[#E86F2A] to-[#c55a1a] rounded-2xl p-8 text-white">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-heading font-bold text-2xl mb-4">{t('forTransporters')}</h3>
              <p className="text-xl text-white/90 mb-6 leading-relaxed">
                "{t('transporterPitch')}"
              </p>
              <ul className="space-y-3">
                {transporterFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
                    <span className="text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={login}
                className="mt-8 bg-[#1B4B7A] hover:bg-[#0f2d4a] text-white font-heading font-semibold"
              >
                {t('findLoads')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-slate-900 mb-4">
              {t('howItWorks')}
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              {t('howItWorksSubtitle') || 'We manage the entire process - from pickup to delivery'}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                step: '01', 
                title: t('step1Title') || 'Post Your Requirement', 
                desc: t('step1Desc') || 'Warehouses share load details. Transporters register their fleet. We take it from there.', 
                icon: Package 
              },
              { 
                step: '02', 
                title: t('step2Title') || 'We Match & Manage', 
                desc: t('step2Desc') || 'Our team assigns the right transporter, handles documentation, and coordinates pickup.', 
                icon: Handshake 
              },
              { 
                step: '03', 
                title: t('step3Title') || 'Track & Deliver', 
                desc: t('step3Desc') || 'Real-time GPS tracking, proof of delivery, and complete transparency until delivery.', 
                icon: MapPin 
              },
            ].map((item, index) => (
              <div key={index} className="relative p-6 bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="text-6xl font-heading font-bold text-[#1B4B7A]/10 absolute top-4 right-4">
                  {item.step}
                </div>
                <div className="w-12 h-12 bg-[#E86F2A]/10 rounded-lg flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#E86F2A]" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-600 text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-slate-900 mb-4">
              {t('featuresTitle') || 'Everything You Need for Seamless Logistics'}
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              {t('featuresSubtitle') || 'Powerful features for warehouses and transporters across India'}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-6 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#E86F2A]/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 bg-[#1B4B7A]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#E86F2A] transition-colors duration-300">
                  <feature.icon className="w-6 h-6 text-[#1B4B7A] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white mb-2">
                {t('aboutUsTitle') || 'About BookMyLoad'}
              </h2>
              <p className="text-[#E86F2A] font-medium mb-6">{t('aboutUsSubtitle') || 'Know About Us'}</p>
              
              <div className="space-y-4 text-slate-300">
                <p>
                  {t('aboutUsDesc1') || 'BookMyLoad is a full-service logistics management company that bridges the gap between warehouses and transporters. Unlike marketplaces that just connect and leave, we MANAGE your entire transport operation.'}
                </p>
                <p>
                  {t('aboutUsDesc2') || 'Founded with a mission to simplify logistics in India, we understand the pain points of both warehouses struggling with unreliable transport and transporters chasing payments and loads. We solve both.'}
                </p>
                <p>
                  {t('aboutUsDesc3') || 'With operations in India and Australia, we bring global standards to local logistics. Our technology-driven approach combined with hands-on management ensures your goods reach safely and on time.'}
                </p>
              </div>

              {/* Key Message */}
              <div className="mt-8 p-4 bg-[#E86F2A]/10 border border-[#E86F2A]/30 rounded-lg">
                <p className="text-[#E86F2A] font-heading font-bold text-lg">
                  {t('notMarketplace')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Warehouse className="w-10 h-10 text-[#E86F2A] mx-auto mb-3" />
                <div className="font-heading font-bold text-2xl text-white">500+</div>
                <div className="text-slate-400 text-sm">{t('warehouses')}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Truck className="w-10 h-10 text-[#E86F2A] mx-auto mb-3" />
                <div className="font-heading font-bold text-2xl text-white">2000+</div>
                <div className="text-slate-400 text-sm">{t('transporters')}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Package className="w-10 h-10 text-[#E86F2A] mx-auto mb-3" />
                <div className="font-heading font-bold text-2xl text-white">10K+</div>
                <div className="text-slate-400 text-sm">{t('loadsDelivered')}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Globe className="w-10 h-10 text-[#E86F2A] mx-auto mb-3" />
                <div className="font-heading font-bold text-2xl text-white">2</div>
                <div className="text-slate-400 text-sm">Countries</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-slate-900 mb-4">
              {t('contactUs')}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* India Office */}
            <div className="bg-slate-50 rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-[#E86F2A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-[#E86F2A]" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">
                {t('indiaOffice')}
              </h3>
              <p className="text-[#1B4B7A] font-bold text-xl">{CONTACT.indiaPhone}</p>
            </div>

            {/* Australia Office */}
            <div className="bg-slate-50 rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-[#E86F2A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-[#E86F2A]" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">
                {t('australiaOffice')}
              </h3>
              <p className="text-[#1B4B7A] font-bold text-xl">{CONTACT.australiaPhone}</p>
            </div>

            {/* Email */}
            <div className="bg-slate-50 rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-[#E86F2A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-[#E86F2A]" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">
                {t('emailUs')}
              </h3>
              <p className="text-[#1B4B7A] font-bold">{CONTACT.email}</p>
            </div>
          </div>

          {/* Address */}
          <div className="mt-8 bg-[#1B4B7A] rounded-lg p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <MapPinned className="w-6 h-6 text-[#E86F2A]" />
              <h3 className="font-heading font-semibold text-lg text-white">{t('address')}</h3>
            </div>
            <p className="text-slate-300">{CONTACT.address}</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#E86F2A] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white mb-4">
            {t('ctaTitle')}
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            {t('ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={login}
              size="lg"
              className="bg-[#1B4B7A] hover:bg-[#0f2d4a] text-white font-heading font-bold uppercase tracking-wide shadow-lg px-8"
            >
              {t('ctaButton') || 'Get Started Free'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{t('noCreditCard')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{t('freeToStart')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <img 
                src="/logo.svg"
                alt="BookMyLoad"
                className="h-16 object-contain mb-4"
              />
              <p className="text-slate-400 text-sm mb-4">
                {t('notMarketplace')}
              </p>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-white mb-4">{t('contact')}</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <p>🇮🇳 {CONTACT.indiaPhone}</p>
                <p>🇦🇺 {CONTACT.australiaPhone}</p>
                <p>✉️ {CONTACT.email}</p>
              </div>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-white mb-4">{t('address')}</h4>
              <p className="text-sm text-slate-400">{CONTACT.address}</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-800">
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white">{t('privacyPolicy')}</a>
              <a href="#" className="hover:text-white">{t('termsOfService')}</a>
            </div>
            <p className="text-slate-500 text-sm">
              © 2024 BookMyLoad. {t('allRightsReserved')}
            </p>
          </div>
        </div>
      </footer>

      {/* Chat Box */}
      <ChatBox />
    </div>
  );
}
