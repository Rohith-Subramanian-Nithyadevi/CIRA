import { createContext, useContext } from 'react';

const FacultyDemoContext = createContext(false);

export const FacultyDemoProvider = FacultyDemoContext.Provider;

export const useFacultyDemo = (): boolean => useContext(FacultyDemoContext);
