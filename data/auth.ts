export type UserRole = 'student' | 'organizer'

export interface AppUser {
  id: string
  name: string
  role: UserRole
}

export const users: AppUser[] = [
  { id: 'stu-1', name: 'Aditi Rao', role: 'student' },
  { id: 'org-1', name: 'Rohan Verma', role: 'organizer' },
  { id: 'stu-2', name: 'Priya Nair', role: 'student' },
  { id: 'stu-3', name: 'Kabir Mehta', role: 'student' },
  { id: 'org-2', name: 'Meera Krishnan', role: 'organizer' },
  { id: 'org-3', name: 'Arjun Patel', role: 'organizer' },
  { id: 'org-4', name: 'Sara Thomas', role: 'organizer' },
]

export function getUserById(id: string): AppUser | undefined {
  return users.find((user) => user.id === id)
}
