import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  Award, 
  ArrowRight,
  Sparkles,
  BookOpen,
  GraduationCap,
  Brain,
  Target,
  Zap,
  CheckCircle2,
  Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export function Landing() {
  const { isAuthenticated, user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/register';
    switch (user.role) {
      case Role.ADMIN:
        return '/admin';
      case Role.TUTOR:
        return '/dashboard/tutor';
      default:
        return '/dashboard/student';
    }
  };

  return (
    <div className="bg-white overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-emerald-50" />
          
          {/* Animated blobs */}
          <div className="absolute top-20 -left-4 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
          <div className="absolute top-40 -right-4 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
          
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230d9488' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative container-wide py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium animate-fade-in">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Tutor Matching</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight animate-slide-up">
                Learn Smarter,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-emerald-500">
                  Not Harder
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 max-w-xl animate-slide-up animation-delay-200">
                Connect with expert tutors instantly. Get personalized help in 
                <span className="font-semibold text-primary-600"> Math</span>,
                <span className="font-semibold text-purple-600"> Physics</span>,
                <span className="font-semibold text-red-500"> Chemistry</span>, and more.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animation-delay-400">
                {isAuthenticated ? (
                  <Link 
                    to={getDashboardLink()} 
                    className="btn-primary btn-lg group"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                ) : (
                  <>
                    <Link 
                      to="/register" 
                      className="btn-primary btn-lg group shadow-glow hover:shadow-glow-lg transition-shadow"
                    >
                      Start Learning Free
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link to="/login" className="btn-secondary btn-lg">
                      I have an account
                    </Link>
                  </>
                )}
              </div>
              
              {/* Trust Indicators */}
              <div className="flex items-center gap-8 pt-4 animate-slide-up animation-delay-600">
                <div className="flex -space-x-2">
                  {['🧑‍🎓', '👩‍🎓', '🧑‍💼', '👨‍🏫'].map((emoji, i) => (
                    <div 
                      key={i}
                      className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-lg"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-bold text-gray-900">1,000+</span> students helped this month
                </div>
              </div>
            </div>
            
            {/* Right - Hero Illustration */}
            <div className="relative hidden lg:block">
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem number="500+" label="Expert Tutors" icon={<Users className="w-6 h-6" />} />
            <StatItem number="10k+" label="Questions Answered" icon={<MessageSquare className="w-6 h-6" />} />
            <StatItem number="< 2min" label="Avg Response Time" icon={<Clock className="w-6 h-6" />} />
            <StatItem number="4.9" label="Student Rating" icon={<Star className="w-6 h-6" />} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Students Love Us
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We've reimagined tutoring for the digital age. Fast, personal, effective.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Matching"
              description="Our AI analyzes your question and matches you with the perfect tutor in seconds."
              color="primary"
            />
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="Expert Tutors"
              description="Every tutor is vetted for expertise and teaching ability. Learn from the best."
              color="purple"
            />
            <FeatureCard
              icon={<Target className="w-6 h-6" />}
              title="Personalized Help"
              description="Get explanations tailored to your level and learning style."
              color="emerald"
            />
            <FeatureCard
              icon={<Clock className="w-6 h-6" />}
              title="24/7 Available"
              description="Stuck at midnight? No problem. Our tutors are available around the clock."
              color="amber"
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="Real-time Chat"
              description="Interactive messaging with typing indicators and instant notifications."
              color="blue"
            />
            <FeatureCard
              icon={<Award className="w-6 h-6" />}
              title="Track Progress"
              description="Review past conversations and see how far you've come."
              color="rose"
            />
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="py-20 bg-white">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Every Subject, Covered
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              From algebra to zoology, we've got experts ready to help.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <SubjectCard name="Mathematics" icon="📐" color="from-teal-400 to-teal-600" />
            <SubjectCard name="Physics" icon="⚡" color="from-violet-400 to-violet-600" />
            <SubjectCard name="Chemistry" icon="🧪" color="from-rose-400 to-rose-600" />
            <SubjectCard name="Biology" icon="🧬" color="from-green-400 to-green-600" />
            <SubjectCard name="English" icon="📚" color="from-orange-400 to-orange-600" />
            <SubjectCard name="History" icon="🏛️" color="from-amber-500 to-amber-700" />
            <SubjectCard name="Geography" icon="🌍" color="from-cyan-400 to-cyan-600" />
            <SubjectCard name="Computer Science" icon="💻" color="from-blue-400 to-blue-600" />
            <SubjectCard name="Economics" icon="📊" color="from-slate-400 to-slate-600" />
            <SubjectCard name="More..." icon="✨" color="from-gray-400 to-gray-600" />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Three simple steps to better grades.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <StepCard
              number="01"
              title="Ask Your Question"
              description="Type your question with as much detail as you can. Our AI analyzes and categorizes it."
              icon={<MessageSquare className="w-8 h-8" />}
            />
            <StepCard
              number="02"
              title="Get Matched"
              description="Within seconds, we match you with an expert tutor in your subject area."
              icon={<Users className="w-8 h-8" />}
            />
            <StepCard
              number="03"
              title="Learn & Succeed"
              description="Chat in real-time, get clear explanations, and master the topic."
              icon={<GraduationCap className="w-8 h-8" />}
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container-wide">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Students Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="I was struggling with calculus for weeks. Top Tutors matched me with a perfect tutor who explained it in a way that finally clicked!"
              name="Sarah M."
              role="Computer Science Student"
            />
            <TestimonialCard
              quote="The instant matching is incredible. I asked a physics question at 11 PM and got help within 2 minutes. My grades have improved so much."
              name="James K."
              role="High School Junior"
            />
            <TestimonialCard
              quote="As a tutor, this platform makes it easy to help students who really need it. The AI matching means I get questions in my areas of expertise."
              name="Dr. Emily R."
              role="Chemistry Tutor"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-emerald-500" />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="relative container-wide text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Ace Your Next Exam?
          </h2>
          <p className="text-primary-100 mb-8 max-w-xl mx-auto text-lg">
            Join thousands of students who've transformed their learning journey.
          </p>
          {!isAuthenticated && (
            <Link 
              to="/register" 
              className="inline-flex items-center px-8 py-4 bg-white text-primary-600 font-bold rounded hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
            >
              Get Started — It's Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container-wide">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-white font-bold text-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span>Top Tutors</span>
            </div>
            <nav className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </nav>
            <p className="text-sm">
              © {new Date().getFullYear()} Top Tutors. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Hero Illustration Component
function HeroIllustration() {
  return (
    <div className="relative w-full h-[500px] animate-fade-in animation-delay-400">
      {/* Main card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-xl shadow-2xl p-6 animate-float">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
            JW
          </div>
          <div>
            <p className="font-semibold text-gray-900">John Williams</p>
            <p className="text-sm text-primary-600">Math Tutor • Online</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-sm text-gray-600">How do I solve x² + 5x + 6 = 0?</p>
          </div>
          <div className="bg-primary-500 text-white rounded-lg p-3 ml-8">
            <p className="text-sm">Great question! Let's factor this together. We need two numbers that...</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce animation-delay-200" />
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce animation-delay-400" />
          </div>
          <span>Typing...</span>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute top-16 left-10 bg-white rounded-lg shadow-lg px-4 py-2 animate-float animation-delay-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
            📐
          </div>
          <span className="font-semibold text-gray-800">Math</span>
        </div>
      </div>

      <div className="absolute top-24 right-4 bg-white rounded-lg shadow-lg px-4 py-2 animate-float animation-delay-400">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
            ⚡
          </div>
          <span className="font-semibold text-gray-800">Physics</span>
        </div>
      </div>

      <div className="absolute bottom-24 left-4 bg-white rounded-lg shadow-lg px-4 py-2 animate-float animation-delay-600">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center">
            🧪
          </div>
          <span className="font-semibold text-gray-800">Chemistry</span>
        </div>
      </div>

      <div className="absolute bottom-16 right-10 bg-white rounded-lg shadow-lg px-4 py-2 animate-float">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="font-semibold text-gray-800">Problem Solved!</span>
        </div>
      </div>
    </div>
  );
}

function StatItem({ number, label, icon }: { number: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 text-primary-600 rounded-lg mb-3">
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-900">{number}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  color 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  color: 'primary' | 'purple' | 'emerald' | 'amber' | 'blue' | 'rose';
}) {
  const colors = {
    primary: 'bg-primary-100 text-primary-600',
    purple: 'bg-purple-100 text-purple-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    rose: 'bg-rose-100 text-rose-600',
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-lg transition-all duration-300 group">
      <div className={`w-12 h-12 ${colors[color]} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function SubjectCard({ name, icon, color }: { name: string; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} text-white p-4 rounded-xl text-center hover:scale-105 transition-transform cursor-pointer shadow-md`}>
      <span className="text-2xl mb-2 block">{icon}</span>
      <span className="font-medium text-sm">{name}</span>
    </div>
  );
}

function StepCard({ 
  number, 
  title, 
  description, 
  icon 
}: { 
  number: string; 
  title: string; 
  description: string; 
  icon: React.ReactNode;
}) {
  return (
    <div className="relative text-center p-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl font-black text-white/10">
        {number}
      </div>
      <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 text-primary-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-gray-700 mb-4 italic">"{quote}"</p>
      <div>
        <p className="font-semibold text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </div>
  );
}

export default Landing;
