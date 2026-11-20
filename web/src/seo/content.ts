/**
 * The public site's search-facing copy. The landing page renders it and the hosted build writes the same text into
 * the page's metadata and structured data, so what a search engine reads is what a visitor sees.
 */
export const site = {
  name: 'Chest Log',
  title: 'Fortnite Chest Counter: See How Many Chests You Have Opened | Chest Log',
  description: 'Count every chest you have opened in Fortnite from your replay files. See your total, your route in each match and the chest routes worth running. Free, and nothing is uploaded.',
  eyebrow: 'Fortnite chest counter for PC',
  intro: 'Chest Log counts every chest you opened, straight from your Fortnite replay files. See your total, replay each match on the map and find the chest routes that pay off.',
}

export const demosFolder = '%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos'

export const features = [
  { title: 'Your chest count', body: 'Every chest you opened, per match and in total. Chests your teammates opened are counted separately.' },
  { title: 'Your routes', body: 'Each match replayed on the island map, with every chest you opened along your path.' },
  { title: 'Routes worth running', body: 'Your drop spots ranked by chests opened, and a planned route through the chests that spawn most often.' },
]

export const faq = [
  {
    question: 'How do I see how many chests I have opened in Fortnite?',
    answer: 'Choose your Fortnite replay folder on this page. Chest Log reads each replay and adds up every chest you opened. It takes about two seconds a match.',
  },
  {
    question: 'Can I see my lifetime chest count?',
    answer: 'Chest Log counts the matches you have replay files for. A match played with Record Replays off, or whose replay was deleted, is not counted.',
  },
  {
    question: 'Are my replays uploaded?',
    answer: 'No. Your browser reads the files on your own computer. Nothing is uploaded and there is no account.',
  },
  {
    question: 'Do chests my teammates opened count?',
    answer: 'Your total counts the chests you opened. Your teammates’ chests are shown separately, and one switch adds them to the total.',
  },
  {
    question: 'Where are Fortnite replay files saved?',
    answer: `On PC they are in ${demosFolder}. Paste that into the address bar of the folder window, then select the folder.`,
  },
  {
    question: 'Does it work on console or mobile?',
    answer: 'No. Fortnite saves replays as files only on PC.',
  },
]
