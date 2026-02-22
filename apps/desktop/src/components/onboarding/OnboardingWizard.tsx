import { useSettingsStore } from '../../stores/settingsStore'
import { templates } from '../../lib/templates'
import { Rocket, Github, FolderPlus, CheckCircle, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react'

const STEPS = ['Welcome', 'GitHub', 'First Project', 'Ready'] as const

export function OnboardingWizard() {
  const { onboardingStep, setOnboardingStep, setOnboardingComplete } = useSettingsStore()

  const handleNext = () => {
    if (onboardingStep < STEPS.length - 1) {
      setOnboardingStep(onboardingStep + 1)
    }
  }

  const handleBack = () => {
    if (onboardingStep > 0) {
      setOnboardingStep(onboardingStep - 1)
    }
  }

  const handleFinish = () => {
    setOnboardingComplete()
  }

  return (
    <div className="h-screen flex items-center justify-center bg-neutral-950 text-white">
      <div className="w-full max-w-lg mx-auto p-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= onboardingStep ? 'bg-white' : 'bg-neutral-700'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="text-center">
          {onboardingStep === 0 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Rocket size={48} className="text-emerald-400" />
              </div>
              <h1 className="text-3xl font-bold">Welcome to Hatch</h1>
              <p className="text-neutral-400 text-lg">
                Build and ship software faster with AI-powered workspaces.
              </p>
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Github size={48} className="text-neutral-300" />
              </div>
              <h1 className="text-2xl font-bold">Connect GitHub</h1>
              <p className="text-neutral-400">
                Link your GitHub account to clone repos and create pull requests.
              </p>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <SkipForward size={14} />
                Skip for now
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <FolderPlus size={48} className="text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold">Your First Project</h1>
              <p className="text-neutral-400 mb-4">
                Start from a template or create a blank workspace.
              </p>
              <div className="space-y-2 text-left">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    className="w-full p-3 rounded-lg border border-neutral-700 hover:border-neutral-500 text-left transition-colors"
                  >
                    <div className="font-medium text-sm">{tmpl.name}</div>
                    <div className="text-xs text-neutral-500">{tmpl.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={48} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold">You're All Set</h1>
              <p className="text-neutral-400">
                Start building something great.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={onboardingStep === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-white disabled:invisible transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {onboardingStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-6 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              Next
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1 px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              Start Building
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
