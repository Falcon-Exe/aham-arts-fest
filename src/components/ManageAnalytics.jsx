import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

export default function ManageAnalytics() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubResults = onSnapshot(query(collection(db, "results"), orderBy("timestamp", "asc")), (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResults(data);
            setLoading(false);
        });

        return () => {
            unsubResults();
        };
    }, []);

    // 1. Team Points Distribution (Pie)
    const teamPoints = results.reduce((acc, res) => {
        const team = res.team || "Independent";
        acc[team] = (acc[team] || 0) + (res.points || 0);
        return acc;
    }, {});

    const pieData = Object.entries(teamPoints).map(([name, value]) => ({ name, value }));

    // 2. Points over time (Momentum - Area Chart)
    // We group by timestamp (simplifying to hourly or sequence)
    const momentumDataRaw = results.reduce((acc, res) => {
        if (!res.timestamp) return acc;
        const date = res.timestamp.toDate ? res.timestamp.toDate() : new Date();
        const timeKey = `${date.getHours()}:00`;
        const team = res.team || "Independent";

        if (!acc[timeKey]) acc[timeKey] = { time: timeKey };
        acc[timeKey][team] = (acc[timeKey][team] || 0) + (res.points || 0);
        return acc;
    }, {});

    const momentumData = Object.values(momentumDataRaw);

    // 3. Participation by Category (Bar)
    const categoryStats = results.reduce((acc, res) => {
        const cat = res.category || "Other";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});

    const barData = Object.entries(categoryStats).map(([name, value]) => ({ name, value }));

    const COLORS = ['#e63946', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];

    if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Analyzing festival data...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>📊 Advanced Festival Analytics</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

                {/* Points Share */}
                <div style={{
                    background: 'var(--surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-soft)'
                }}>
                    <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>Overall Points Share (%)</h4>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#111', border: '1px solid var(--border-soft)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Event Distribution */}
                <div style={{
                    background: 'var(--surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-soft)'
                }}>
                    <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>Events Completed by Category</h4>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ background: '#111', border: '1px solid var(--border-soft)', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Team Momentum */}
                <div style={{
                    background: 'var(--surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-soft)',
                    gridColumn: '1 / -1'
                }}>
                    <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>Team Momentum (Points Hourly Trend)</h4>
                    <div style={{ height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={momentumData}>
                                <defs>
                                    {Object.keys(teamPoints).map((team, i) => (
                                        <linearGradient key={team} id={`color${team.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <XAxis dataKey="time" stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                                <Tooltip
                                    contentStyle={{ background: '#111', border: '1px solid var(--border-soft)', borderRadius: '8px' }}
                                />
                                <Legend />
                                {Object.keys(teamPoints).map((team, i) => (
                                    <Area
                                        key={team}
                                        type="monotone"
                                        dataKey={team}
                                        stroke={COLORS[i % COLORS.length]}
                                        fillOpacity={1}
                                        fill={`url(#color${team.replace(/\s+/g, '')})`}
                                        strokeWidth={3}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}
