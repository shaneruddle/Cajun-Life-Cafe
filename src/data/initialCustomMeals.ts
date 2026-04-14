import { CustomMealItem } from '../types';

export const INITIAL_CUSTOM_MEALS: Partial<CustomMealItem>[] = [
  {
    name: "Chicken Breast",
    type: "Protein",
    description: "(All Exact Weights are Before Cooking)",
    order: 1,
    options: [
      { weight: "50 G", price: 30, calories: 55, protein: 12, carbs: 0, fat: 1 },
      { weight: "100 G", price: 50, calories: 110, protein: 23, carbs: 0, fat: 2 },
      { weight: "200 G", price: 90, calories: 220, protein: 46, carbs: 0, fat: 6 }
    ]
  },
  {
    name: "Chicken Breast Minced",
    type: "Protein",
    description: "",
    order: 2,
    options: [
      { weight: "50 G", price: 30, calories: 55, protein: 12, carbs: 0, fat: 1 },
      { weight: "100 G", price: 50, calories: 110, protein: 23, carbs: 0, fat: 2 },
      { weight: "200 G", price: 90, calories: 220, protein: 46, carbs: 0, fat: 6 }
    ]
  },
  {
    name: "Pork Tenderloin",
    type: "Protein",
    description: "",
    order: 3,
    options: [
      { weight: "100 G", price: 70, calories: 120, protein: 21, carbs: 0, fat: 3 },
      { weight: "200 G", price: 135, calories: 240, protein: 42, carbs: 0, fat: 7 }
    ]
  },
  {
    name: "Jasmin Rice",
    type: "Carbohydrates",
    description: "(White)",
    order: 1,
    options: [
      { weight: "100 G", price: 15, calories: 130, protein: 2, carbs: 28, fat: 0 },
      { weight: "150 G", price: 20, calories: 195, protein: 3, carbs: 42, fat: 0 },
      { weight: "200 G", price: 25, calories: 260, protein: 4, carbs: 56, fat: 0 }
    ]
  },
  {
    name: "Brocolli",
    type: "Vegetables",
    description: "",
    order: 1,
    options: [
      { weight: "100 G", price: 25, calories: 34, protein: 3, carbs: 7, fat: 0 },
      { weight: "150 G", price: 35, calories: 51, protein: 4.5, carbs: 10.5, fat: 0 }
    ]
  },
  {
    name: "Avocado",
    type: "Fats",
    description: "",
    order: 1,
    options: [
      { weight: "50 G", price: 45, calories: 80, protein: 1, carbs: 4, fat: 7 },
      { weight: "100 G", price: 85, calories: 160, protein: 2, carbs: 8, fat: 14 }
    ]
  }
];
