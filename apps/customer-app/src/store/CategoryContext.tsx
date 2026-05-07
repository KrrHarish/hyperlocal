import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface AppCategory {
  id: string;
  key: string;
  name: string;
  emoji: string;
  description: string;
  is_active: boolean;
  under_construction: boolean;
  sort_order: number;
}

interface CategoryContextType {
  selectedCategory: AppCategory | null;
  setSelectedCategory: (cat: AppCategory | null) => void;
}

const CategoryContext = createContext<CategoryContextType>({
  selectedCategory: null,
  setSelectedCategory: () => {},
});

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | null>(null);
  return (
    <CategoryContext.Provider value={{ selectedCategory, setSelectedCategory }}>
      {children}
    </CategoryContext.Provider>
  );
}

export const useCategory = () => useContext(CategoryContext);
