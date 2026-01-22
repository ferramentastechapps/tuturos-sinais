import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePortfolio } from "./usePortfolio";

describe("usePortfolio", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty portfolio", () => {
    const { result } = renderHook(() => usePortfolio());
    expect(result.current.assets).toEqual([]);
  });

  it("should add asset to portfolio", () => {
    const { result } = renderHook(() => usePortfolio());
    
    act(() => {
      result.current.addAsset({
        symbol: "BTC",
        name: "Bitcoin",
        amount: 1,
        averagePrice: 50000,
        currentPrice: 55000,
      });
    });

    expect(result.current.assets).toHaveLength(1);
    expect(result.current.assets[0].symbol).toBe("BTC");
    expect(result.current.assets[0].amount).toBe(1);
  });

  it("should calculate total portfolio value", () => {
    const { result } = renderHook(() => usePortfolio());
    
    act(() => {
      result.current.addAsset({
        symbol: "BTC",
        name: "Bitcoin",
        amount: 1,
        averagePrice: 50000,
        currentPrice: 55000,
      });
      result.current.addAsset({
        symbol: "ETH",
        name: "Ethereum",
        amount: 10,
        averagePrice: 3000,
        currentPrice: 3500,
      });
    });

    const totalValue = 55000 + (10 * 3500);
    expect(result.current.totalValue).toBe(totalValue);
  });

  it("should remove asset from portfolio", () => {
    const { result } = renderHook(() => usePortfolio());
    
    act(() => {
      result.current.addAsset({
        symbol: "BTC",
        name: "Bitcoin",
        amount: 1,
        averagePrice: 50000,
        currentPrice: 55000,
      });
    });

    const assetId = result.current.assets[0].id;

    act(() => {
      result.current.removeAsset(assetId);
    });

    expect(result.current.assets).toHaveLength(0);
  });

  it("should persist portfolio to localStorage", () => {
    const { result } = renderHook(() => usePortfolio());
    
    act(() => {
      result.current.addAsset({
        symbol: "BTC",
        name: "Bitcoin",
        amount: 1,
        averagePrice: 50000,
        currentPrice: 55000,
      });
    });

    const stored = localStorage.getItem("portfolio");
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].symbol).toBe("BTC");
  });
});
