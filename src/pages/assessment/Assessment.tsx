import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronLeft, ChevronRight, Clock, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAssessmentStore } from '@/store/assessmentStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getQuestionsForAssessment, scoreResponse } from '@/lib/assessmentRuntime';
import type { QuestionResponse } from '@/types';

const categoryColors: Record<string, string> = {
  verbal: 'bg-blue-500/20 text-blue-400',
  logical: 'bg-green-500/20 text-green-400',
  spatial: 'bg-purple-500/20 text-purple-400',
  processing: 'bg-amber-500/20 text-amber-400',
};

export default function Assessment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    assessmentId,
    ageGroup,
    userAge,
    currentQuestion,
    responses,
    addResponse,
    nextQuestion,
    previousQuestion,
    startTime,
  } = useAssessmentStore();
  const [questions, setQuestions] = useState<ReturnType<typeof getQuestionsForAssessment>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [direction, setDirection] = useState(1);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());

  useEffect(() => {
    const resolvedAge = userAge ?? Number(localStorage.getItem('pz_user_age'));

    if (!assessmentId || !ageGroup || Number.isNaN(resolvedAge)) {
      navigate('/assessment/age-select');
      return;
    }

    setQuestions(getQuestionsForAssessment(ageGroup, resolvedAge));
    setLoading(false);
  }, [assessmentId, ageGroup, navigate, userAge]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime) setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const existing = responses.find((response) => response.question_id === questions[currentQuestion]?.id);
    setSelectedOption(existing?.selected_option || null);
    setQuestionStartedAt(Date.now());
  }, [currentQuestion, questions, responses]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optionKey: string) => {
    const question = questions[currentQuestion];
    if (!question) return;

    const responseTime = Math.max(0, Date.now() - questionStartedAt);
    setSelectedOption(optionKey);
    addResponse({
      question_id: question.id,
      answer_value: scoreResponse(question, optionKey),
      selected_option: optionKey,
      response_time_ms: responseTime,
    });
  };

  const handleNext = () => {
    setDirection(1);
    nextQuestion();
  };

  const handlePrev = () => {
    setDirection(-1);
    previousQuestion();
  };

  const handleSubmit = async () => {
    if (!assessmentId || !user || !ageGroup) return;

    const age = userAge ?? Number(localStorage.getItem('pz_user_age'));
    if (Number.isNaN(age)) {
      toast.error('Your age is missing. Please restart the assessment.');
      navigate('/assessment/age-select');
      return;
    }

    setSubmitting(true);
    try {
      const responseRows = responses.map((response: QuestionResponse) => ({
        assessment_id: assessmentId,
        question_id: response.question_id,
        answer_value: response.answer_value,
        selected_option: response.selected_option,
        response_time_ms: response.response_time_ms,
      }));

      await supabase.from('responses').insert(responseRows);

      const { error } = await supabase.functions.invoke('submit-assessment', {
        body: {
          assessment_id: assessmentId,
          responses,
          age_group: ageGroup,
          age,
          user_id: user.id,
        },
      });

      if (error) throw error;

      toast.success('Assessment submitted!');
      navigate(`/results/${assessmentId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Brain className="h-16 w-16 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  if (!question) return null;

  const total = questions.length;
  const options = question.options ?? [];

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-20 flex-col items-center py-8 border-r border-border/50 bg-card/30">
        <Brain className="h-8 w-8 text-primary mb-6" />
        <div className="flex-1 flex flex-col gap-1 overflow-auto">
          {questions.map((item, index) => (
            <div
              key={item.id}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentQuestion ? 'bg-primary glow-effect' :
                index < currentQuestion && responses.find((response) => response.question_id === item.id) ? 'bg-primary/50' :
                'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl flex items-center justify-between mb-8">
          <Badge className={categoryColors[question.category] || ''}>
            {question.category.charAt(0).toUpperCase() + question.category.slice(1)}
          </Badge>
          <span className="text-muted-foreground text-sm">Question {currentQuestion + 1} of {total}</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-mono">{formatTime(elapsed)}</span>
          </div>
        </div>

        <div className="w-full max-w-2xl h-2 bg-muted rounded-full mb-8">
          <div className="h-full rounded-full gradient-bg transition-all duration-300" style={{ width: `${((currentQuestion + 1) / total) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 50 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl space-y-8"
          >
            <h2 className="text-2xl md:text-3xl font-semibold leading-relaxed">{question.question_text}</h2>

            <div className="grid gap-3">
              {options.map((option) => (
                <motion.button
                  key={option.key}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelectOption(option.key)}
                  className={`glass-card p-4 text-left flex items-center gap-4 transition-all border-2 ${
                    selectedOption === option.key ? 'border-primary bg-primary/10' : 'border-transparent hover:border-primary/30'
                  }`}
                >
                  <span className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                    selectedOption === option.key ? 'gradient-bg text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {option.key}
                  </span>
                  <span className="text-lg">{option.text}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="w-full max-w-2xl flex items-center justify-between mt-8">
          <Button variant="outline" onClick={handlePrev} disabled={currentQuestion === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          {currentQuestion === total - 1 ? (
            <Button className="gradient-bg glow-effect" onClick={handleSubmit} disabled={submitting || responses.length < total}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Assessment
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!selectedOption}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
