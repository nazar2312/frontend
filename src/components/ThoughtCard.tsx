import { Pencil, Trash2 } from 'lucide-react';
import { Thought, User } from '../types';
import { motion } from 'motion/react';
import React from 'react';

interface ThoughtCardProps {
  thought: Thought;
  currentUser?: User | null;
  onDelete?: (id: string) => void;
  onEdit?: (thought: Thought) => void;
}

export const ThoughtCard: React.FC<ThoughtCardProps> = ({
                                                          thought,
                                                          currentUser,
                                                          onDelete,
                                                          onEdit,
                                                        }) => {
  const initials = thought.author.username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const formattedDate = new Date(thought.created).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const canModify =
      currentUser?.email === thought.author.email || currentUser?.role === 'ADMIN';

  return (
      <motion.article
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="h-full flex flex-col justify-between p-6 rounded-3xl relative overflow-hidden
        bg-white/50 backdrop-blur-2xl border border-white/80
        shadow-[0_2px_12px_rgba(0,0,0,0.05),0_12px_40px_rgba(0,0,0,0.08)]
        hover:shadow-[0_4px_16px_rgba(0,0,0,0.08),0_20px_56px_rgba(0,0,0,0.11)]
        hover:bg-white/65 transition-all duration-300 cursor-pointer"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

        <div className="relative">
          {thought.category && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-black/5 px-2.5 py-1 rounded-full mb-4 inline-block">
            {thought.category.name}
          </span>
          )}
          <h2 className="text-[18px] font-bold text-zinc-900 leading-snug tracking-tight mb-3">
            {thought.title}
          </h2>
          <p className="text-[13px] leading-relaxed text-zinc-500 line-clamp-3 mb-4">
            {thought.content}
          </p>
          {thought.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {thought.tags.slice(0, 3).map((tag) => (
                    <span key={tag.name} className="text-[11px] font-semibold text-blue-400">
                #{tag.name}
              </span>
                ))}
              </div>
          )}
        </div>

        <div className="relative flex items-center justify-between pt-4 border-t border-black/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white text-[10px] font-black">
              {initials}
            </div>
            <div>
              <p className="text-[12px] font-bold text-zinc-700">{thought.author.username}</p>
              <p className="text-[10px] text-zinc-400">{formattedDate}</p>
            </div>
          </div>

          {canModify && (
              <div className="flex items-center gap-1">
                {onEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(thought); }}
                        className="p-1.5 rounded-full hover:bg-black/5 text-zinc-300 hover:text-zinc-600 transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(thought.id); }}
                        className="p-1.5 rounded-full hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                )}
              </div>
          )}
        </div>
      </motion.article>
  );
};
