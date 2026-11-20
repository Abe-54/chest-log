import { faq, features, site } from './content'

// The hosted build also renders these to plain HTML from vite.config.ts, so they use no hooks and no `~` imports.

export function LandingHero() {
  return (
    <>
      <p className="text-sm font-medium text-mist">{site.eyebrow}</p>
      <h1 className="display mt-3 text-6xl leading-[0.9] sm:text-8xl">How many chests have <span className="text-gold">you</span> opened in Fortnite?</h1>
      <p className="mt-5 max-w-xl text-lg text-mist">{site.intro}</p>
    </>
  )
}

export function LandingDetails() {
  return (
    <>
      <section className="mt-12 border-t border-line/70 pt-8">
        <h2 className="display text-3xl">What you get</h2>
        <ul className="mt-4 grid gap-5 sm:grid-cols-3">
          {features.map(feature => (
            <li key={feature.title}>
              <h3 className="font-semibold text-bone">{feature.title}</h3>
              <p className="mt-1 text-sm text-mist">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-12 border-t border-line/70 pt-8">
        <h2 className="display text-3xl">Questions</h2>
        <dl className="mt-4 space-y-5">
          {faq.map(entry => (
            <div key={entry.question}>
              <dt className="font-semibold text-bone">{entry.question}</dt>
              <dd className="mt-1 max-w-2xl text-sm text-mist">{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}

export const landingFrame = 'mx-auto max-w-3xl px-4 pt-10 pb-16 sm:pt-16'

/** What the page shows before the app has loaded: the same copy, with the replay picker still to come. */
export function StaticLanding() {
  return (
    <main data-static-landing className={landingFrame}>
      <LandingHero />
      <p className="mt-8 rounded-3xl border-2 border-dashed border-line bg-ink-2 p-6 text-sm text-mist sm:p-8">Loading the replay reader.</p>
      <LandingDetails />
    </main>
  )
}
