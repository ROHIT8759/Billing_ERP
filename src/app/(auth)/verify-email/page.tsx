import { MailCheck } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MailCheck size={32} className="text-indigo-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">Check your email</h2>
        <p className="text-slate-400 text-sm mb-8">
          We&apos;ve sent you a verification link. Please check your inbox and click the link to activate your account.
        </p>

        <Link href="/login" className="block w-full">
          <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">
            Return to Login
          </Button>
        </Link>
      </div>
    </div>
  )
}
