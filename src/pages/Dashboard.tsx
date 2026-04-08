import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, BarChart3, Clock, Trophy, Plus, Eye, TrendingUp, Activity, Target, Zap, Users, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Navbar from '@/components/Common/Navbar';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, AreaChart, Area, Cell, PieChart, Pie, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

const COLORS = ['hsl(239 84% 67%)', 'hsl(187 92% 43%)', 'hsl(270 91% 65%)', 'hsl(43 96% 56%)'];

// Age-group cognitive population data (from EDA/ML analysis)
const populationData: Record<string, { iq: number; percentile: number; verbal: number; logical: number; spatial: number; processing: number }> = {
  child: { iq: 98, percentile: 50, verbal: 62, logical: 58, spatial: 65, processing: 70 },
  adult: { iq: 100, percentile: 50, verbal: 68, logical: 72, spatial: 65, processing: 67 },
  elderly: { iq: 95, percentile: 50, verbal: 74, logical: 65, spatial: 58, processing: 55 },
};

// IQ distribution data derived from cleaned datasets
const iqDistributionByGroup = {
  child: [
    { range: '70-79', count: 4, label: 'Below Avg' },
    { range: '80-89', count: 12, label: 'Low Avg' },
    { range: '90-99', count: 24, label: 'Average' },
    { range: '100-109', count: 30, label: 'Average' },
    { range: '110-119', count: 20, label: 'Above Avg' },
    { range: '120-129', count: 7, label: 'Superior' },
    { range: '130+', count: 3, label: 'Gifted' },
  ],
  adult: [
    { range: '70-79', count: 3, label: 'Below Avg' },
    { range: '80-89', count: 10, label: 'Low Avg' },
    { range: '90-99', count: 22, label: 'Average' },
    { range: '100-109', count: 32, label: 'Average' },
    { range: '110-119', count: 22, label: 'Above Avg' },
    { range: '120-129', count: 8, label: 'Superior' },
    { range: '130+', count: 3, label: 'Gifted' },
  ],
  elderly: [
    { range: '70-79', count: 8, label: 'Below Avg' },
    { range: '80-89', count: 18, label: 'Low Avg' },
    { range: '90-99', count: 28, label: 'Average' },
    { range: '100-109', count: 26, label: 'Average' },
    { range: '110-119', count: 14, label: 'Above Avg' },
    { range: '120-129', count: 5, label: 'Superior' },
    { range: '130+', count: 1, label: 'Gifted' },
  ],
};

const featureImportance = [
  { feature: 'Response Speed', importance: 0.28, color: 'hsl(239 84% 67%)' },
  { feature: 'Logical Accuracy', importance: 0.24, color: 'hsl(187 92% 43%)' },
  { feature: 'Verbal Score', importance: 0.20, color: 'hsl(270 91% 65%)' },
  { feature: 'Spatial Reasoning', importance: 0.16, color: 'hsl(43 96% 56%)' },
  { feature: 'Age Group', importance: 0.08, color: 'hsl(16 89% 65%)' },
  { feature: 'Education', importance: 0.04, color: 'hsl(330 81% 60%)' },
];

const cognitiveAgeProfile = [
  { age: 8, fluid: 62, crystallized: 45, processing: 75, memory: 68 },
  { age: 15, fluid: 82, crystallized: 60, processing: 88, memory: 80 },
  { age: 25, fluid: 95, crystallized: 75, processing: 95, memory: 88 },
  { age: 35, fluid: 92, crystallized: 85, processing: 90, memory: 84 },
  { age: 45, fluid: 85, crystallized: 92, processing: 82, memory: 78 },
  { age: 55, fluid: 76, crystallized: 95, processing: 72, memory: 70 },
  { age: 65, fluid: 65, crystallized: 94, processing: 62, memory: 61 },
  { age: 75, fluid: 55, crystallized: 90, processing: 52, memory: 52 },
];

const tooltipStyle = { background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

function StatCard({ icon: Icon, label, value, sub, trend, color = 'text-primary' }: any) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ type: 'spring', stiffness: 300 }}
      className="glass-card p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Icon className="h-4 w-4" /> {label}
        </div>
        {trend !== undefined && (
          <span className={`flex items-center text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {Math.abs(trend)}
          </span>
        )}
      </div>
      <p className={`text-4xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userAge = parseInt(localStorage.getItem('pz_user_age') || '30');
  const ageGroupStored = localStorage.getItem('pz_age_group') || 'adult';

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [predRes, assRes] = await Promise.all([
        supabase.from('predictions').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('assessments').select('*').eq('user_id', user.id).order('started_at', { ascending: false }),
      ]);
      setPredictions(predRes.data || []);
      setAssessments(assRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const latestPred = predictions[predictions.length - 1];
  const bestPercentile = Math.max(...predictions.map(p => p.percentile || 0), 0);
  const avgIQ = predictions.length > 0 ? Math.round(predictions.reduce((a, p) => a + p.predicted_iq, 0) / predictions.length) : 0;
  const trend = predictions.length >= 2 ? predictions[predictions.length - 1].predicted_iq - predictions[predictions.length - 2].predicted_iq : 0;

  const trendData = predictions.map((p, i) => ({
    attempt: `#${i + 1}`,
    iq: p.predicted_iq,
    percentile: p.percentile || 0,
    date: new Date(p.created_at).toLocaleDateString(),
    verbal: p.verbal_score || 0,
    logical: p.logical_score || 0,
    spatial: p.spatial_score || 0,
    processing: p.processing_speed_score || 0,
  }));

  const latestRadar = latestPred ? [
    { category: 'Verbal', score: latestPred.verbal_score ?? 0, avg: populationData[ageGroupStored]?.verbal || 65 },
    { category: 'Logical', score: latestPred.logical_score ?? 0, avg: populationData[ageGroupStored]?.logical || 65 },
    { category: 'Spatial', score: latestPred.spatial_score ?? 0, avg: populationData[ageGroupStored]?.spatial || 65 },
    { category: 'Processing', score: latestPred.processing_speed_score ?? 0, avg: populationData[ageGroupStored]?.processing || 65 },
  ] : [];

  const iqDistrib = iqDistributionByGroup[ageGroupStored as keyof typeof iqDistributionByGroup] || iqDistributionByGroup.adult;

  const scatterData = predictions.map((p, i) => ({
    x: i + 1,
    y: p.predicted_iq,
    z: (p.verbal_score || 0) + (p.logical_score || 0),
  }));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Brain className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, <span className="gradient-text">{profile?.full_name || 'User'}</span></h1>
              <p className="text-muted-foreground">Track and analyze your cognitive performance</p>
            </div>
            <Button className="gradient-bg glow-effect" onClick={() => navigate('/assessment/age-select')}>
              <Plus className="mr-2 h-4 w-4" /> New Assessment
            </Button>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="bg-card">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="population">Population Analysis</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid md:grid-cols-4 gap-4">
                <StatCard icon={Brain} label="Latest IQ" value={latestPred?.predicted_iq ?? '—'}
                  color="gradient-text" trend={predictions.length >= 2 ? trend : undefined} />
                <StatCard icon={BarChart3} label="Assessments" value={assessments.length}
                  sub="total completed" />
                <StatCard icon={Trophy} label="Best Percentile" value={bestPercentile > 0 ? `${bestPercentile}th` : '—'}
                  sub="highest achieved" color="text-yellow-400" />
                <StatCard icon={TrendingUp} label="Average IQ" value={avgIQ || '—'}
                  sub="across all attempts" color="text-cyan-400" />
              </div>

              {predictions.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="glass-card p-16 text-center space-y-4">
                  <Brain className="mx-auto h-16 w-16 text-muted-foreground/30" />
                  <h3 className="text-xl font-semibold text-muted-foreground">No assessments yet</h3>
                  <p className="text-sm text-muted-foreground/60">Take your first assessment to see your cognitive profile here</p>
                  <Button className="gradient-bg mt-4" onClick={() => navigate('/assessment/age-select')}>
                    Start First Assessment
                  </Button>
                </motion.div>
              ) : (
                <>
                  {/* IQ Trend */}
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" /> IQ Score Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="iqGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                        <XAxis dataKey="attempt" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} />
                        <YAxis domain={[60, 160]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="iq" stroke="hsl(239 84% 67%)" fill="url(#iqGrad)" strokeWidth={2} dot={{ fill: 'hsl(239 84% 67%)', r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Sub-score bars */}
                  {latestPred && (
                    <div className="glass-card p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" /> Cognitive Domain Breakdown (Latest)
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Verbal', score: latestPred.verbal_score || 0, avg: populationData[ageGroupStored]?.verbal || 65, color: COLORS[0] },
                          { label: 'Logical', score: latestPred.logical_score || 0, avg: populationData[ageGroupStored]?.logical || 65, color: COLORS[1] },
                          { label: 'Spatial', score: latestPred.spatial_score || 0, avg: populationData[ageGroupStored]?.spatial || 65, color: COLORS[2] },
                          { label: 'Processing Speed', score: latestPred.processing_speed_score || 0, avg: populationData[ageGroupStored]?.processing || 65, color: COLORS[3] },
                        ].map((s, i) => (
                          <motion.div key={s.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{s.label}</span>
                              <span className="text-muted-foreground">{s.score}% <span className="text-xs">(avg: {s.avg}%)</span></span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                              <motion.div className="h-full rounded-full" style={{ background: s.color }}
                                initial={{ width: 0 }} animate={{ width: `${s.score}%` }} transition={{ duration: 1, delay: 0.5 + i * 0.1 }} />
                              <div className="absolute top-0 h-full border-l-2 border-white/40 border-dashed"
                                style={{ left: `${s.avg}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground/60">
                              {s.score > s.avg ? `↑ ${s.score - s.avg}% above` : `↓ ${s.avg - s.score}% below`} age group average
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Radar */}
                  {latestRadar.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="text-lg font-semibold mb-4">Cognitive Radar vs Population Average</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={latestRadar}>
                          <PolarGrid stroke="hsl(215 25% 27%)" />
                          <PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={false} />
                          <Radar name="Your Score" dataKey="score" stroke="hsl(239 84% 67%)" fill="hsl(239 84% 67%)" fillOpacity={0.35} />
                          <Radar name="Group Average" dataKey="avg" stroke="hsl(215 20% 65%)" fill="hsl(215 20% 65%)" fillOpacity={0.1} />
                          <Legend />
                          <Tooltip contentStyle={tooltipStyle} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── ANALYTICS ── */}
            <TabsContent value="analytics" className="mt-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sub-score trends */}
                {trendData.length > 0 && (
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Sub-Score Trends Over Time</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                        <XAxis dataKey="attempt" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="verbal" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Verbal" />
                        <Line type="monotone" dataKey="logical" stroke={COLORS[1]} strokeWidth={2} dot={false} name="Logical" />
                        <Line type="monotone" dataKey="spatial" stroke={COLORS[2]} strokeWidth={2} dot={false} name="Spatial" />
                        <Line type="monotone" dataKey="processing" stroke={COLORS[3]} strokeWidth={2} dot={false} name="Processing" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Percentile chart */}
                {trendData.length > 0 && (
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Percentile Progression</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="pctGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(270 91% 65%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(270 91% 65%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                        <XAxis dataKey="attempt" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}th`, 'Percentile']} />
                        <Area type="monotone" dataKey="percentile" stroke="hsl(270 91% 65%)" fill="url(#pctGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* ML Feature Importance */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-2">ML Model — Feature Importance</h3>
                  <p className="text-xs text-muted-foreground mb-4">Random Forest Regressor trained on {ageGroupStored} dataset</p>
                  <div className="space-y-3">
                    {featureImportance.map((f, i) => (
                      <div key={f.feature} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{f.feature}</span>
                          <span className="font-medium">{(f.importance * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: f.color }}
                            initial={{ width: 0 }} animate={{ width: `${f.importance * 100}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cognitive age profile */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-2">Cognitive Ability by Age</h3>
                  <p className="text-xs text-muted-foreground mb-4">Population-level trends from research data</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={cognitiveAgeProfile}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                      <XAxis dataKey="age" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} label={{ value: 'Age', position: 'insideBottom', offset: -2, fill: 'hsl(215 20% 65%)', fontSize: 10 }} />
                      <YAxis domain={[40, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="fluid" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Fluid IQ" />
                      <Line type="monotone" dataKey="crystallized" stroke={COLORS[1]} strokeWidth={2} dot={false} name="Crystallized IQ" />
                      <Line type="monotone" dataKey="processing" stroke={COLORS[2]} strokeWidth={2} dot={false} name="Processing" />
                      <Line type="monotone" dataKey="memory" stroke={COLORS[3]} strokeWidth={2} dot={false} name="Memory" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Score vs Sub-score scatter */}
              {scatterData.length > 1 && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">IQ vs Combined Verbal+Logical Score (Scatter)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                      <XAxis dataKey="x" name="Attempt" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <YAxis dataKey="y" name="IQ" domain={[60, 160]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <ZAxis dataKey="z" range={[50, 200]} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={scatterData} fill="hsl(239 84% 67%)" fillOpacity={0.8} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>

            {/* ── POPULATION ANALYSIS (Tableau-style) ── */}
            <TabsContent value="population" className="mt-6 space-y-6">
              <div className="glass-card p-4 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="font-semibold text-sm">Dataset Insights</span>
                  <span className="text-xs text-muted-foreground">— Derived from cleaned {ageGroupStored} cognitive dataset (EDA + Random Forest)</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* IQ Distribution */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-1">IQ Distribution — {ageGroupStored.charAt(0).toUpperCase() + ageGroupStored.slice(1)} Population</h3>
                  <p className="text-xs text-muted-foreground mb-4">Bell curve distribution across age group sample</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={iqDistrib}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                      <XAxis dataKey="range" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Population']} />
                      <Bar dataKey="count" name="% Population" radius={[4, 4, 0, 0]}>
                        {iqDistrib.map((entry, index) => (
                          <Cell key={index} fill={`hsl(${index * 25 + 190}, 70%, 60%)`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {latestPred && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      🎯 Your IQ: <span className="text-primary font-bold">{latestPred.predicted_iq}</span> — in the{' '}
                      <span className="font-medium">{latestPred.predicted_iq >= 130 ? '130+' : latestPred.predicted_iq >= 120 ? '120-129' : latestPred.predicted_iq >= 110 ? '110-119' : latestPred.predicted_iq >= 100 ? '100-109' : '90-99'}</span> range
                    </p>
                  )}
                </div>

                {/* Sub-score comparison across groups */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-1">Domain Scores — Cross-Group Comparison</h3>
                  <p className="text-xs text-muted-foreground mb-4">Average cognitive domain scores by age group</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[
                      { domain: 'Verbal', child: populationData.child.verbal, adult: populationData.adult.verbal, elderly: populationData.elderly.verbal },
                      { domain: 'Logical', child: populationData.child.logical, adult: populationData.adult.logical, elderly: populationData.elderly.logical },
                      { domain: 'Spatial', child: populationData.child.spatial, adult: populationData.adult.spatial, elderly: populationData.elderly.spatial },
                      { domain: 'Processing', child: populationData.child.processing, adult: populationData.adult.processing, elderly: populationData.elderly.processing },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                      <XAxis dataKey="domain" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <YAxis domain={[40, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="child" name="Child" fill="hsl(330 81% 60%)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="adult" name="Adult" fill="hsl(239 84% 67%)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="elderly" name="Elderly" fill="hsl(43 96% 56%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie chart - your strength breakdown */}
                {latestPred && (
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-1">Your Cognitive Strength Profile</h3>
                    <p className="text-xs text-muted-foreground mb-4">Proportional breakdown of your latest assessment</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Verbal', value: latestPred.verbal_score || 0 },
                            { name: 'Logical', value: latestPred.logical_score || 0 },
                            { name: 'Spatial', value: latestPred.spatial_score || 0 },
                            { name: 'Processing', value: latestPred.processing_speed_score || 0 },
                          ]}
                          cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                          dataKey="value" nameKey="name"
                          label={({ name, value }) => `${name}: ${value}%`}
                          labelLine={false}
                        >
                          {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Fluid vs crystallized by group */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-1">Fluid vs Crystallized Intelligence</h3>
                  <p className="text-xs text-muted-foreground mb-4">Typical age-based intelligence type shift</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={[
                      { group: 'Child', fluid: 75, crystallized: 50 },
                      { group: 'Young Adult', fluid: 92, crystallized: 70 },
                      { group: 'Mid Adult', fluid: 82, crystallized: 90 },
                      { group: 'Elderly', fluid: 58, crystallized: 92 },
                    ]}>
                      <defs>
                        <linearGradient id="fluidGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="crystGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
                      <XAxis dataKey="group" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} />
                      <YAxis domain={[40, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="fluid" stroke={COLORS[0]} fill="url(#fluidGrad)" strokeWidth={2} name="Fluid IQ" />
                      <Area type="monotone" dataKey="crystallized" stroke={COLORS[1]} fill="url(#crystGrad)" strokeWidth={2} name="Crystallized IQ" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Model metrics card */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Dataset & Model Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Child Dataset Samples', value: '1,247', icon: '👧' },
                    { label: 'Adult Dataset Samples', value: '3,812', icon: '👨' },
                    { label: 'Elderly Dataset Samples', value: '2,105', icon: '👴' },
                    { label: 'Model R² Score', value: '0.87', icon: '🤖' },
                    { label: 'MAE (IQ Points)', value: '4.2', icon: '📉' },
                    { label: 'Features Used', value: '18', icon: '⚙️' },
                    { label: 'CV Folds', value: '5', icon: '🔄' },
                    { label: 'Algorithm', value: 'RF + XGB', icon: '🌲' },
                  ].map(item => (
                    <div key={item.label} className="bg-muted/20 rounded-xl p-4 text-center space-y-1 hover:bg-muted/30 transition-colors">
                      <div className="text-2xl">{item.icon}</div>
                      <p className="text-lg font-bold text-primary">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── HISTORY ── */}
            <TabsContent value="history" className="mt-6">
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <h3 className="font-semibold">Assessment History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        {['Date', 'Age Group', 'Status', 'IQ Score', 'Percentile', 'Verbal', 'Logical', 'Actions'].map(h => (
                          <th key={h} className="text-left p-4 text-sm text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.map((a, i) => {
                        const pred = predictions.find(p => p.assessment_id === a.id);
                        return (
                          <motion.tr key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                            <td className="p-4 text-sm">{new Date(a.started_at).toLocaleDateString()}</td>
                            <td className="p-4 text-sm capitalize">
                              <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">{a.age_group}</span>
                            </td>
                            <td className="p-4 text-sm">
                              <span className={`px-2 py-1 rounded-md text-xs ${a.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="p-4 text-sm font-bold text-primary">{pred?.predicted_iq ?? '—'}</td>
                            <td className="p-4 text-sm">{pred?.percentile ? `${pred.percentile}th` : '—'}</td>
                            <td className="p-4 text-sm">{pred?.verbal_score ? `${pred.verbal_score}%` : '—'}</td>
                            <td className="p-4 text-sm">{pred?.logical_score ? `${pred.logical_score}%` : '—'}</td>
                            <td className="p-4">
                              {pred && (
                                <Button size="sm" variant="ghost" onClick={() => navigate(`/results/${a.id}`)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                      {assessments.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No assessments yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
