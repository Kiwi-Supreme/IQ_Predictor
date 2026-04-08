import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BarChart3, RotateCcw, LayoutDashboard, Share2, TrendingUp, Award, BookOpen, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Prediction } from '@/types';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  AreaChart, Area, PieChart, Pie, Legend,
} from 'recharts';
import Navbar from '@/components/Common/Navbar';

const tooltipStyle = { background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

function IQRing({ score, max = 160 }: { score: number; max?: number }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / max, 1);
  const dashoffset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="200" height="200" className="-rotate-90">
        <circle cx="100" cy="100" r={radius} strokeWidth="10" fill="none" className="stroke-muted" />
        <motion.circle cx="100" cy="100" r={radius} strokeWidth="10" fill="none"
          strokeLinecap="round" className="stroke-primary"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeDasharray={circumference} />
      </svg>
      <div className="absolute text-center">
        <motion.p className="text-5xl font-extrabold gradient-text"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {score}
        </motion.p>
        <p className="text-sm text-muted-foreground">IQ Score</p>
      </div>
    </div>
  );
}

function getInterpretation(iq: number) {
  if (iq >= 145) return { label: 'Profoundly Gifted', desc: 'Exceptional in less than 1 in 1,000 people', color: 'text-violet-400', emoji: '🌟' };
  if (iq >= 130) return { label: 'Superior / Gifted', desc: 'Top 2% — exceptional cognitive ability', color: 'text-accent', emoji: '✨' };
  if (iq >= 115) return { label: 'Above Average', desc: 'Top 16% — sharp, analytical thinker', color: 'text-green-400', emoji: '🎯' };
  if (iq >= 100) return { label: 'Average', desc: 'Well within the normal range (50th–84th percentile)', color: 'text-blue-400', emoji: '✅' };
  if (iq >= 85) return { label: 'Low Average', desc: 'Slight room for growth in some domains', color: 'text-yellow-400', emoji: '📈' };
  return { label: 'Below Average', desc: 'Targeted practice can meaningfully improve scores', color: 'text-orange-400', emoji: '💪' };
}

function getAgeInsight(iq: number, age: number, ageGroup: string) {
  const baseAge = age || (ageGroup === 'child' ? 9 : ageGroup === 'adult' ? 35 : 68);
  if (ageGroup === 'child') {
    const developmental = baseAge <= 7 ? 'early childhood phase' : baseAge <= 10 ? 'middle childhood phase' : 'late childhood phase';
    return {
      context: `At ${baseAge} years old during the ${developmental}, your PPVT-based cognitive score of ${iq} reflects ${iq >= 105 ? 'above-typical' : iq >= 95 ? 'on-track' : 'developing'} verbal-cognitive development.`,
      tips: iq >= 110
        ? ['Enrich with advanced reading and puzzles', 'Consider STEM enrichment programs', 'Encourage creative problem-solving activities']
        : ['Focus on vocabulary-building exercises', 'Regular reading practice boosts verbal IQ', 'Pattern games improve logical reasoning'],
      dataset: 'Child Dataset (PPVT Score — Normalized)',
    };
  }
  if (ageGroup === 'adult') {
    const phase = baseAge <= 30 ? 'peak fluid intelligence' : baseAge <= 45 ? 'balanced intelligence phase' : 'crystallized intelligence dominance';
    return {
      context: `At ${baseAge} years, you are in the ${phase}. Your cognitive score of ${iq} is ${iq >= 110 ? 'notably strong' : iq >= 95 ? 'well-positioned' : 'has room for growth'} relative to your Memory Test Score and Stress-Level-adjusted baseline.`,
      tips: iq >= 115
        ? ['Maintain mental challenge through complex tasks', 'Explore cognitive training apps', 'Sleep optimization preserves processing speed']
        : ['Reduce daily screen time to improve focus', 'Mindfulness practices improve processing speed', 'Social engagement strengthens crystallized IQ'],
      dataset: 'Adult Dataset (Cognitive Score, Memory Test, Stress Level)',
    };
  }
  return {
    context: `At ${baseAge} years, your MMSE-calibrated score of ${iq} shows ${iq >= 100 ? 'strong preservation of cognitive function' : 'some age-typical cognitive changes'}. GDS-adjusted baseline places you in the ${iq >= 105 ? 'above-average' : 'average'} range for your age cohort.`,
    tips: iq >= 100
      ? ['Cognitive stimulation through reading and puzzles', 'Social activities protect executive function', 'Physical exercise improves memory consolidation']
      : ['Regular memory exercises (e.g., word lists)', 'Consult a professional for personalized guidance', 'Consistent sleep schedule supports cognitive health'],
    dataset: 'Old People Dataset (MMSE Score, GDS Score, Chronic Disease Risk)',
  };
}

const normativeBands = [
  { range: '< 70', label: 'Extremely Low', pct: 2 },
  { range: '70–84', label: 'Below Average', pct: 14 },
  { range: '85–99', label: 'Low Average', pct: 34 },
  { range: '100–114', label: 'Average', pct: 34 },
  { range: '115–129', label: 'Above Average', pct: 14 },
  { range: '130+', label: 'Superior / Gifted', pct: 2 },
];

export default function Results() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const userAge = parseInt(localStorage.getItem('pz_user_age') || '0');
  const ageGroup = localStorage.getItem('pz_age_group') || 'adult';

  useEffect(() => {
    if (!assessmentId) return;
    const fetchPrediction = async () => {
      const { data, error } = await supabase
        .from('predictions').select('*').eq('assessment_id', assessmentId).single();
      if (error) toast.error('Failed to load results');
      else setPrediction(data as unknown as Prediction);
      setLoading(false);
    };
    setTimeout(fetchPrediction, 1500);
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="relative"
          >
            <Brain className="h-20 w-20 text-primary" />
            <motion.div className="absolute inset-0 rounded-full border-2 border-primary/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }} />
          </motion.div>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold">Analyzing your results...</p>
            <motion.div className="flex gap-1 justify-center">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                  animate={{ y: [0, -8, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </motion.div>
            <p className="text-sm text-muted-foreground">Running ML model inference...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-xl text-muted-foreground">Results not found</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const interp = getInterpretation(prediction.predicted_iq);
  const insight = getAgeInsight(prediction.predicted_iq, userAge, ageGroup);

  const radarData = [
    { category: 'Verbal', score: prediction.verbal_score ?? 0, avg: ageGroup === 'child' ? 62 : ageGroup === 'elderly' ? 74 : 68 },
    { category: 'Logical', score: prediction.logical_score ?? 0, avg: ageGroup === 'child' ? 58 : ageGroup === 'elderly' ? 65 : 72 },
    { category: 'Spatial', score: prediction.spatial_score ?? 0, avg: ageGroup === 'child' ? 65 : ageGroup === 'elderly' ? 58 : 65 },
    { category: 'Processing', score: prediction.processing_speed_score ?? 0, avg: ageGroup === 'child' ? 70 : ageGroup === 'elderly' ? 55 : 67 },
  ];

  const subScores = [
    { label: 'Verbal', score: prediction.verbal_score ?? 0, color: 'hsl(239 84% 67%)' },
    { label: 'Logical', score: prediction.logical_score ?? 0, color: 'hsl(187 92% 43%)' },
    { label: 'Spatial', score: prediction.spatial_score ?? 0, color: 'hsl(270 91% 65%)' },
    { label: 'Processing Speed', score: prediction.processing_speed_score ?? 0, color: 'hsl(43 96% 56%)' },
  ];

  // IQ position in normative curve
  const iqInBand = normativeBands.map(b => ({
    ...b,
    isUser: (prediction.predicted_iq >= 130 && b.range === '130+') ||
             (prediction.predicted_iq >= 115 && prediction.predicted_iq < 130 && b.range === '115–129') ||
             (prediction.predicted_iq >= 100 && prediction.predicted_iq < 115 && b.range === '100–114') ||
             (prediction.predicted_iq >= 85 && prediction.predicted_iq < 100 && b.range === '85–99') ||
             (prediction.predicted_iq >= 70 && prediction.predicted_iq < 85 && b.range === '70–84') ||
             (prediction.predicted_iq < 70 && b.range === '< 70'),
  }));

  const pieData = [
    { name: 'Verbal', value: prediction.verbal_score || 0 },
    { name: 'Logical', value: prediction.logical_score || 0 },
    { name: 'Spatial', value: prediction.spatial_score || 0 },
    { name: 'Processing', value: prediction.processing_speed_score || 0 },
  ];
  const PIE_COLORS = ['hsl(239 84% 67%)', 'hsl(187 92% 43%)', 'hsl(270 91% 65%)', 'hsl(43 96% 56%)'];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">

          {/* Score ring + interpretation */}
          <div className="text-center space-y-6">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <IQRing score={prediction.predicted_iq} />
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              <p className={`text-3xl font-bold ${interp.color}`}>{interp.emoji} {interp.label}</p>
              <p className="text-muted-foreground mt-1">{interp.desc}</p>
              {prediction.percentile && (
                <p className="mt-2 text-muted-foreground">
                  You scored higher than{' '}
                  <span className="text-foreground font-bold">{prediction.percentile}%</span> of your age group
                </p>
              )}
              {userAge > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm">
                  <Brain className="h-4 w-4 text-primary" />
                  <span>Age {userAge} • {ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)} Group</span>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Age-specific insight */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}
            className="glass-card p-6 border border-primary/20 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              Age-Specific Cognitive Insight
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{insight.context}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 border-t border-border/30 pt-3">
              <BookOpen className="h-3 w-3" />
              Data source: <span className="text-primary/70">{insight.dataset}</span>
            </div>
          </motion.div>

          {/* Sub-score bars */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
            className="glass-card p-6 space-y-5">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Cognitive Domain Scores
            </h3>
            <div className="space-y-4">
              {subScores.map((s, i) => {
                const avg = radarData.find(r => r.category === s.label.split(' ')[0])?.avg || 65;
                return (
                  <motion.div key={s.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5 + i * 0.12 }} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">
                        {s.score}% <span className="text-xs">(group avg: {avg}%)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                      <motion.div className="h-full rounded-full" style={{ background: s.color }}
                        initial={{ width: 0 }} animate={{ width: `${s.score}%` }}
                        transition={{ duration: 1, delay: 1.8 + i * 0.1 }} />
                      <div className="absolute top-0 h-full border-l-2 border-white/30 border-dashed"
                        style={{ left: `${avg}%` }} title={`Group avg: ${avg}%`} />
                    </div>
                    <p className="text-xs text-muted-foreground/60">
                      {s.score > avg ? `↑ ${s.score - avg} pts above` : s.score < avg ? `↓ ${avg - s.score} pts below` : 'At'} group average
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Charts grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Radar chart */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
              className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Score vs Group Average</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(215 25% 27%)" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                  <Radar name="Your Score" dataKey="score" stroke="hsl(239 84% 67%)" fill="hsl(239 84% 67%)" fillOpacity={0.35} />
                  <Radar name="Group Avg" dataKey="avg" stroke="hsl(215 20% 65%)" fill="hsl(215 20% 65%)" fillOpacity={0.1} />
                  <Legend />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Pie chart */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }}
              className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Cognitive Strength Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} innerRadius={40}
                    dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Normative bar chart */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
              className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-1">Your Position in Normative Distribution</h3>
              <p className="text-xs text-muted-foreground mb-4">Population % in each IQ band</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={iqInBand}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                  <XAxis dataKey="range" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 9 }} />
                  <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Population']} />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {iqInBand.map((entry, i) => (
                      <Cell key={i} fill={entry.isUser ? 'hsl(239 84% 67%)' : 'hsl(215 25% 27%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-center text-muted-foreground mt-2">
                🔵 Highlighted bar = your IQ range ({prediction.predicted_iq})
              </p>
            </motion.div>

            {/* Area comparison */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }}
              className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-1">Your Scores vs Population Average</h3>
              <p className="text-xs text-muted-foreground mb-4">Direct comparison across cognitive domains</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={radarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} />
                  <YAxis dataKey="category" type="category" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} width={70} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="score" name="Your Score" fill="hsl(239 84% 67%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avg" name="Group Avg" fill="hsl(215 25% 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Recommendations */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 }}
            className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" /> Personalized Recommendations
              {userAge > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">(Age {userAge})</span>}
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {insight.tips.map((tip, i) => (
                <motion.div key={tip} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.5 + i * 0.1 }}
                  className="bg-muted/20 rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-colors">
                  <div className="text-2xl mb-2">{['🧠', '📚', '⚡'][i]}</div>
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }}
            className="flex flex-wrap gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate('/assessment/age-select')}>
              <RotateCcw className="mr-2 h-4 w-4" /> Retake Assessment
            </Button>
            <Button className="gradient-bg glow-effect" onClick={() => navigate('/dashboard')}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> View Dashboard
            </Button>
            <Button variant="outline" onClick={() => {
              navigator.clipboard.writeText(`I scored ${prediction.predicted_iq} IQ on PsychZenith! 🧠 Try it at psychzenith.app`);
              toast.success('Copied to clipboard!');
            }}>
              <Share2 className="mr-2 h-4 w-4" /> Share Result
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
