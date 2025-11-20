# TD Audio Player - Agent Configuration Summary

This document provides an overview of all specialized AI agents configured for this project.

## Agent Roster

### 🐛 [Debugger Agent](./debugger.agent.md)
**Focus**: Runtime errors, type issues, Supabase integration problems, React lifecycle bugs

**Invoke when**:
- Errors or unexpected behavior
- TypeScript compilation fails
- Supabase operations fail
- Audio playback issues
- State synchronization bugs

**Key expertise**:
- React hooks and lifecycle
- HTMLAudioElement management
- Supabase query debugging
- Type safety enforcement
- localStorage issues

---

### 🎨 [Designer Agent](./designer.agent.md)
**Focus**: UI/UX, Tailwind styling, responsive design, brand consistency

**Invoke when**:
- Visual changes needed
- Responsive design issues
- New UI elements
- Animation requests
- Brand aesthetic questions

**Key expertise**:
- Tailwind utility-first patterns
- Slughouse Records brand identity
- Mobile-first responsive design
- Framer Motion for drag-drop
- Accessibility improvements

---

### 📊 [Database Agent](./database.agent.md)
**Focus**: Supabase schema, PostgreSQL queries, storage buckets, RLS policies

**Invoke when**:
- Schema changes needed
- New tables or columns
- Storage bucket configuration
- Query optimization
- Data migrations
- RLS policy creation

**Key expertise**:
- PostgreSQL schema design
- Supabase Storage setup
- snake_case ↔ camelCase mappings
- Type-safe database operations
- Migration strategies

---

### 🚦 [Delegator Agent](./delegator.agent.md)
**Focus**: Task routing, multi-agent coordination, request analysis

**Invoke when**:
- First point of contact (default)
- Complex multi-domain requests
- Unclear task requirements
- Need to orchestrate multiple specialists

**Key expertise**:
- Request type analysis
- Agent capability matching
- Multi-agent sequencing
- Context handoff
- Result synthesis

---

### ⚡ [Performance Agent](./performance.agent.md)
**Focus**: React optimization, bundle size, audio streaming, query performance

**Invoke when**:
- App feels slow or laggy
- Bundle size concerns
- Audio stuttering
- Memory leaks suspected
- Unnecessary re-renders
- Load time issues

**Key expertise**:
- React rendering optimization
- Code splitting strategies
- Audio prefetching
- Supabase query caching
- Bundle analysis

---

### 📚 [Documentation Agent](./documentation.agent.md)
**Focus**: README, API docs, inline comments, troubleshooting guides

**Invoke when**:
- New features need docs
- Setup process changes
- User confusion reported
- Onboarding new developers
- Deployment updates

**Key expertise**:
- User-facing setup guides
- API documentation (JSDoc)
- Architecture documentation
- Troubleshooting guides
- Changelog maintenance

---

### 🧪 [Testing Agent](./testing.agent.md)
**Focus**: Manual test strategies, validation, edge cases, cross-browser testing

**Invoke when**:
- New feature complete
- Bug fix needs verification
- Pre-deployment checks
- Browser compatibility questions
- User flow validation

**Key expertise**:
- Systematic test checklists
- Edge case identification
- Cross-browser testing
- Regression testing
- Bug report documentation

---

## Agent Selection Guide

### Quick Reference Table

| Need | Primary Agent | Support Agents |
|------|--------------|----------------|
| Fix bug | Debugger | Testing (verify fix) |
| Add feature | Delegator | Database → Designer → Testing |
| Change UI | Designer | Testing (verify responsive) |
| Optimize speed | Performance | Debugger (fix bottlenecks) |
| Update docs | Documentation | - |
| Database change | Database | Debugger (integration) |
| Complex project | Delegator | Coordinates all others |
| Pre-release check | Testing | All (regression checks) |

### Decision Flow

```
User Request
    ↓
    ├─ Bug/Error? → Debugger
    ├─ Visual/UI? → Designer
    ├─ Database? → Database
    ├─ Slow/Heavy? → Performance
    ├─ Unclear/Big? → Delegator
    ├─ Docs? → Documentation
    └─ Verify? → Testing
```

## Agent Coordination Patterns

### Sequential Flow
```
Database → Debugger → Designer → Testing
Example: Add new feature requiring schema, logic, UI, and validation
```

### Parallel Flow
```
Designer (UI) || Documentation (README) || Testing (test plan)
Example: Independent tasks that don't block each other
```

### Iterative Flow
```
Designer → User Feedback → Designer → Testing → Deploy
Example: UI refinement requiring multiple iterations
```

## Common Agent Combinations

### New Feature Development
1. **Delegator** - Break down feature
2. **Database** - Schema changes (if needed)
3. **Debugger** - Implement logic
4. **Designer** - Create UI
5. **Testing** - Validate functionality
6. **Documentation** - Update docs

### Bug Investigation
1. **Debugger** - Identify root cause
2. **Testing** - Reproduce and document
3. **Debugger** - Fix bug
4. **Testing** - Verify fix and regression test
5. **Documentation** - Add to troubleshooting guide (if common)

### Performance Issue
1. **Performance** - Profile and identify bottleneck
2. **Debugger** - Fix code issues
3. **Designer** - Optimize animations/rendering
4. **Testing** - Verify no functionality broken
5. **Documentation** - Document optimization patterns

### Pre-Release Checklist
1. **Testing** - Full regression test suite
2. **Debugger** - Fix any critical bugs found
3. **Designer** - Final UX polish
4. **Documentation** - Update README and changelog
5. **Performance** - Bundle size check
6. **Testing** - Cross-browser validation

## Agent Boundaries

### What Agents DON'T Do
- **No overlapping responsibilities** - Each has clear domain
- **No architectural decisions alone** - Complex changes require Delegator coordination
- **No feature removal** - Only fix bugs or add features
- **No unauthorized schema changes** - Database agent documents, user approves
- **No automated test writing** - Project uses manual testing

### What ALL Agents DO
- Document their changes
- Report progress clearly
- Stay within their expertise
- Defer to specialists when needed
- Consider user impact
- Verify changes don't break existing functionality

## Custom Agent Invocation

In your prompts, you can directly invoke agents:

```
"@Debugger - tracks won't play after upload"
"@Designer - make the volume control more prominent"
"@Database - add a ratings column to tracks"
"@Delegator - add playlist feature" (will coordinate multiple agents)
"@Performance - app loads slowly on mobile"
"@Documentation - document the shuffle algorithm"
"@Testing - verify repeat modes before deployment"
```

## Future Agent Suggestions

As the project grows, consider adding:

- **Security Agent** - If user auth added (authentication flows, RLS policies, secrets management)
- **Analytics Agent** - If tracking added (event instrumentation, metrics analysis)
- **Deployment Agent** - If CI/CD added (build pipelines, environment configs)
- **Migration Agent** - If major version upgrades needed (dependency updates, breaking changes)

---

**Last Updated**: Project initialization  
**Maintained By**: Documentation Agent  
**Review Schedule**: Update when new agents added or agent responsibilities change
