import { Suspense } from 'react'
import { Sidebar } from '@/components/app-shell/sidebar'
import { Topbar } from '@/components/app-shell/topbar'
import { UnreadCount } from '@/components/app-shell/unread-count'
import { UserFooter } from '@/components/app-shell/user-footer'
import { Skeleton } from '@/components/ui/skeleton'

function UserFooterSlot() {
  return (
    <Suspense fallback={<Skeleton className="h-14 w-full rounded-xl" />}>
      <UserFooter />
    </Suspense>
  )
}

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh">
      <Sidebar footer={<UserFooterSlot />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          mobileFooter={<UserFooterSlot />}
          bellBadge={
            <Suspense fallback={null}>
              <UnreadCount />
            </Suspense>
          }
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
