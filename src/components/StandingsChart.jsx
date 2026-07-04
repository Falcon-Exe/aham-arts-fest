import React from 'react';
import './StandingsChart.css';

/**
 * Horizontal progress-bar style standings chart (matching Home.jsx BattleArena style).
 * teamColors: { "TEAMNAME": "#hexcolor" }
 */
export default function StandingsChart({ scores, activeCategory, subCategory, teamColors = {} }) {
    if (!scores || scores.length === 0) return null;

    const maxVal = Math.max(...scores.map(s => s.total), 1);

    // Default colour palette for teams without assigned colours
    const defaultPalette = [
        '#e63946', '#3b82f6', '#10b981', '#f59e0b',
        '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'
    ];

    const getColor = (name, index) => {
        const key = (name || '').toUpperCase();
        return teamColors[key] || defaultPalette[index % defaultPalette.length];
    };

    return (
        <div className="standings-chart-container">
            <div className="chart-header-row">
                <h4 className="chart-title">
                    📊 {activeCategory} Standings
                    {subCategory && subCategory !== 'All' && (
                        <span className="chart-subtitle"> — {subCategory}</span>
                    )}
                </h4>
                <span className="chart-meta">Live · {scores.length} teams</span>
            </div>

            <div className="chart-hbar-list">
                {scores.map((s, index) => {
                    const teamName = s.name || s.team;
                    const pct = Math.max((s.total / maxVal) * 100, 2);
                    const color = getColor(teamName, index);
                    const rank = index + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

                    return (
                        <div key={teamName} className="chart-hbar-row">
                            <div className="chart-hbar-rank">{medal}</div>
                            <div className="chart-hbar-name">{teamName}</div>
                            <div className="chart-hbar-track">
                                <div
                                    className="chart-hbar-fill"
                                    style={{
                                        width: `${pct}%`,
                                        background: `linear-gradient(90deg, ${color} 0%, ${color}99 100%)`,
                                        boxShadow: `0 0 12px ${color}55`,
                                        transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                />
                            </div>
                            <div className="chart-hbar-pts" style={{ color }}>
                                {s.total} <span className="chart-pts-label">pts</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
