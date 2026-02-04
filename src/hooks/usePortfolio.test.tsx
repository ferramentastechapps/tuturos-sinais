import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePortfolio } from "./usePortfolio";
import React from "react";

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe("usePortfolio", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty portfolio", () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    expect(result.current.assets).toEqual([]);
  });

  it("should have summary with default values", () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current.summary).toBeDefined();
    expect(result.current.summary.totalValue).toBeGreaterThanOrEqual(0);
    expect(result.current.summary.totalInvested).toBeGreaterThanOrEqual(0);
  });

  it("should expose addAsset function with correct signature", () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    
    expect(typeof result.current.addAsset).toBe("function");
    expect(result.current.addAsset.length).toBe(3); // symbol, quantity, buyPrice (fee is optional)
  });

  it("should expose removeAsset function", () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    
    expect(typeof result.current.removeAsset).toBe("function");
  });

  it("should expose updateAsset function", () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    
    expect(typeof result.current.updateAsset).toBe("function");
  });

  it("should persist empty portfolio to localStorage on init", () => {
    renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });

    // Check that localStorage key is correct
    const stored = localStorage.getItem("crypto-portfolio");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual([]);
  });
});
