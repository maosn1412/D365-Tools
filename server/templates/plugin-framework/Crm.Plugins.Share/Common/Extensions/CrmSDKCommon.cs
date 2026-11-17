/**
 *  Plugin通用方法库(系统标准方法)
 */
namespace Crm.Plugins.Share.Common.Extensions
{

    using Microsoft.Crm.Sdk.Messages;
    using Microsoft.Xrm.Sdk;
    using Microsoft.Xrm.Sdk.Messages;
    using Microsoft.Xrm.Sdk.Metadata;
    using Microsoft.Xrm.Sdk.Query;
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Text;
    using System.Xml;
    using System.Xml.Schema;

    public static class CrmSDKCommon
    {

        /// <summary>
        /// 获取用户所处时区
        /// </summary>
        /// <param name="organizationService"></param>
        /// <param name="userId"></param>
        /// <returns></returns>
        public static TimeZoneInfo GetCurrentUserTimeZoneInfo(IOrganizationService organizationService, Guid userId)
        {
            QueryExpression queryExpression = new QueryExpression("usersettings");
            queryExpression.ColumnSet = new ColumnSet("systemuserid");
            queryExpression.Criteria.AddCondition("systemuserid", ConditionOperator.Equal, userId);
            LinkEntity linkEntity = new LinkEntity("usersettings", "timezonedefinition", "timezonecode", "timezonecode", JoinOperator.Inner);
            linkEntity.EntityAlias = "zone";
            linkEntity.Columns = new ColumnSet("standardname");
            queryExpression.LinkEntities.Add(linkEntity);
            EntityCollection entityCollection = organizationService.RetrieveMultiple(queryExpression);
            if (entityCollection != null && entityCollection.Entities != null && entityCollection.Entities.Count > 0)
            {
                Entity entity = entityCollection.Entities[0];
                if (entity.Contains("zone.standardname"))
                {
                    string text = entity.GetAttributeValue<AliasedValue>("zone.standardname").Value.ToString();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        return TimeZoneInfo.FindSystemTimeZoneById(text);
                    }
                }
            }
            return null;
        }


        /// <summary>
        /// 根据用户时区转换时间
        /// </summary>
        /// <param name="organizationService">组织服务</param>
        /// <param name="utcTime">UTC时间</param>
        /// <param name="userId">用户ID</param>
        /// <returns>转换后的本地时间</returns>
        public static DateTime ConvertToUserLocalTime(IOrganizationService organizationService, Guid userId,DateTime utcTime)
        {
            TimeZoneInfo userTimeZone = GetCurrentUserTimeZoneInfo(organizationService, userId);
            if (userTimeZone != null)
            {
                return TimeZoneInfo.ConvertTimeFromUtc(utcTime, userTimeZone);
            }
            else
            {
                throw new Exception("无法获取用户时区信息。");
            }
        }


        /// <summary>
        /// 复制一条新的实体记录,除了系统标准字段以外,其他字段都复制
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="etnOriginalData">原实体记录</param>
        /// <returns>返回新实体记录的Entity对象</returns>
        public static Entity Clone(this Entity etnOriginalData,List<string> exceptList)
        {
            if (etnOriginalData == null || string.IsNullOrEmpty(etnOriginalData.LogicalName) || etnOriginalData.Id == Guid.Empty)
            { 
                return null;
            }
            #region 系统标准字段
            List<string> aryFieldName_NotCopied =new List<string>{ "createdby", "createdon", "createdonbehalfby", "importsequencenumber", "modifiedby", "modifiedon", "modifiedonbehalfby",
                                                                     "overriddencreatedon","statecode","statuscode","timezoneruleversionnumber","utcconversiontimezonecode",
                                                                     "versionnumber",$"{etnOriginalData.LogicalName}id"};
            if (exceptList.Any())
            {
                aryFieldName_NotCopied.AddRange(exceptList);
            }
            #endregion 系统标准字段
            Entity etnNewData = new Entity(etnOriginalData.LogicalName);
            foreach (string strAttributeName in etnOriginalData.Attributes.Keys.ToList())
            {
                string strFieldLogicalName = strAttributeName.ToLower();
                if (aryFieldName_NotCopied.Contains(strFieldLogicalName))
                {
                    continue;
                }
                if (etnOriginalData.IsNotNull(strFieldLogicalName))
                {
                    etnNewData[strFieldLogicalName] = etnOriginalData[strFieldLogicalName];
                }
            }
            return etnNewData;
        }

        /// <summary>
        /// 复制一条新的实体记录(只复制自定义字段和exceptFieldList中定义的字段)
        /// </summary>
        /// <param name="service"></param>
        /// <param name="etnOriginalData"></param>
        /// <param name="aryFieldValue"></param>
        /// <param name="blnIsCopySharePrivilege"></param>
        /// <param name="publisherPrefix"></param>
        /// <returns></returns>
        public static Entity Clone(this IOrganizationService service, Entity etnOriginalData, List<string> exceptFieldList, string publisherPrefix = "new_")
        {
            if (etnOriginalData == null || string.IsNullOrEmpty(etnOriginalData.LogicalName) || etnOriginalData.Id == Guid.Empty)
            {
                return null;
            }
            Entity etnNewData = new Entity(etnOriginalData.LogicalName);
            foreach (string strAttributeName in etnOriginalData.Attributes.Keys.ToList())
            {
                string strFieldLogicalName = strAttributeName.ToLower();
                #region 复制自定义字段和exceptFieldList中定义的字段
                if ((exceptFieldList.Any() && exceptFieldList.Contains(strFieldLogicalName)) || (strFieldLogicalName.StartsWith(publisherPrefix) && strFieldLogicalName != $"{etnOriginalData.LogicalName}id"))
                {
                    etnNewData[strFieldLogicalName] = etnOriginalData[strFieldLogicalName];
                    continue;
                }
                #endregion 
            }
            return etnNewData;
        }

        /// <summary>
        /// 复制创建一条实体记录，只复制自定义字段及ownerid
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="etnOriginalData">原实体记录</param>
        /// <param name="aryFieldValue">部分需要特殊赋值的字段</param>
        /// <param name="blnIsCopySharePrivilege">是否复制原实体记录的共享权限列表</param>
        /// <param name="publisherPrefix">发布者.前缀</param>
        /// <returns>返回新实体记录的Entity对象</returns>
        public static Entity CopyEntityData(this IOrganizationService service, Entity etnOriginalData, FieldValueModel[] aryFieldValue = null, bool blnIsCopySharePrivilege = false, string publisherPrefix = "new_")
        {
            if (etnOriginalData == null || string.IsNullOrEmpty(etnOriginalData.LogicalName) || etnOriginalData.Id == Guid.Empty) return null;

            Entity etnNewData = new Entity(etnOriginalData.LogicalName);
            foreach (string strAttributeName in etnOriginalData.Attributes.Keys.ToList())
            {
                string strFieldLogicalName = strAttributeName.ToLower();

                #region 自定义实体
                if (strFieldLogicalName == "ownerid" || (strFieldLogicalName.StartsWith(publisherPrefix) && strFieldLogicalName != $"{etnOriginalData.LogicalName}id"))
                {
                    etnNewData[strFieldLogicalName] = etnOriginalData[strFieldLogicalName];
                    continue;
                }
                #endregion 自定义实体

                #region 系统标准实体
                string[] aryFieldName_NotCopied = new string[] { "createdby", "createdon", "createdonbehalfby", "importsequencenumber", "modifiedby", "modifiedon", "modifiedonbehalfby",
                                                                     "overriddencreatedon","statecode","statuscode","timezoneruleversionnumber","utcconversiontimezonecode",
                                                                     "versionnumber",$"{etnOriginalData.LogicalName}id"};

                if (aryFieldName_NotCopied.Contains(strFieldLogicalName)) continue;

                if (etnOriginalData.IsNotNull(strFieldLogicalName)) etnNewData[strFieldLogicalName] = etnOriginalData[strFieldLogicalName];
                #endregion 系统标准实体
            }

            if (aryFieldValue != null)
            {
                etnNewData.AddAttr(aryFieldValue.ToList().FindAll(fv => fv.EntityLogicalName == etnNewData.LogicalName).ToArray());
            }
            etnNewData.Id = service.Create(etnNewData);

            #region 复制共享权限
            if (blnIsCopySharePrivilege)
            {
                service.CopySharedPrincipalAccess(etnOriginalData.ToEntityReference(), etnNewData.ToEntityReference());
            }
            #endregion 复制共享权限

            return etnNewData;
        }

        /// <summary>
        /// 批量复制创建实体记录，只复制自定义字段及ownerid
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="ecOriginalData">原实体记录集合</param>
        /// <param name="aryFieldValue">部分需要特殊赋值的字段</param>
        /// <param name="blnIsCopySharePrivilege">是否复制原实体记录的共享权限列表</param>
        /// <returns>返回新实体记录的Entity对象集合</returns>
        public static EntityCollection CopyEntityData(this IOrganizationService service, EntityCollection ecOriginalData, FieldValueModel[] aryFieldValue = null, bool blnIsCopySharePrivilege = false, string publisherPrefix = "new_")
        {
            if (ecOriginalData == null || ecOriginalData.Entities.Count == 0) return null;

            IList<Entity> listNewData = new List<Entity>();
            ecOriginalData.Entities.ToList().ForEach(etnOriginalData =>
            {
                listNewData.Add(service.CopyEntityData(etnOriginalData, aryFieldValue, blnIsCopySharePrivilege, publisherPrefix));
            });

            return new EntityCollection(listNewData);
        }

        /// <summary>
        /// 通过实体关系映射配置的字段为新建记录赋值
        /// </summary>
        /// <param name="service"></param>
        /// <param name="etnSource">源实体记录</param>
        /// <param name="etnTarget_Create">目标实体记录</param>
        /// <returns>返回源实体字段名与目标实体字段名的集合，Dictionary中的key为源实体实体字段名，value为目标实体字段名</returns>
        public static Dictionary<string, string> SetValueByEntityMap(this IOrganizationService service, Entity etnSource, ref Entity etnTarget_Create)
        {
            Dictionary<string, string> dictResult = new Dictionary<string, string>();
            if (etnSource == null || etnTarget_Create == null) return dictResult;

            EntityCollection ecEntityMap = service.QuickRetrieveMultiple("entitymap", new string[] { "sourceentityname", "targetentityname" },
                                                                                      new object[] { etnSource.LogicalName, etnTarget_Create.LogicalName },
                                                                                      "entitymapid");
            if (ecEntityMap != null && ecEntityMap.Entities.Count > 0)
            {
                foreach (Entity etnLoop_EntityMap in ecEntityMap.Entities)
                {
                    EntityCollection ecAttrMap = service.QuickRetrieveMultiple("attributemap", new string[] { "entitymapid", "issystem" },
                                                                                       new object[] { etnLoop_EntityMap.Id, false },
                                                                                       "parentattributemapid", "sourceattributename", "targetattributename");
                    List<Entity> listAttributeMap = ecAttrMap != null && ecAttrMap.Entities.Count > 0 ?
                                                        ecAttrMap.Entities.ToList().FindAll(etn => !etn.IsNotNull("parentattributemapid")) : new List<Entity>();
                    if (listAttributeMap != null && listAttributeMap.Count > 0)
                    {
                        foreach (Entity etnLoop_AttributeMap in listAttributeMap)
                        {
                            string strSourceAttributeName = etnLoop_AttributeMap.ToString("sourceattributename");
                            string strTargetAttributeName = etnLoop_AttributeMap.ToString("targetattributename");
                            if (etnSource.IsNotNull(strSourceAttributeName)) etnTarget_Create[strTargetAttributeName] = etnSource[strSourceAttributeName];
                            dictResult.Add(strSourceAttributeName, strTargetAttributeName);
                        }
                    }
                }
            }

            return dictResult;
        }

        /// <summary>
        /// 删除父实体及子实体的数据
        /// </summary>
        /// <param name="service"></param>
        /// <param name="erParent">父实体ER对象</param>
        /// <param name="dictDetailDefinition">子实体定义字典，其中字典中的Key存放子实体的实体逻辑名，Value存放子实体中关联父实体的查找字段</param>
        public static void DeleteEntityAndDetail(this IOrganizationService service, EntityReference erParent, Dictionary<string, string> dictDetailDefinition)
        {
            if (!erParent.IsNotNull()) return;

            service.Delete(erParent.LogicalName, erParent.Id);//删除父实体记录

            foreach (string strEntityName in dictDetailDefinition.Keys)
            {
                string strRelatedParentFieldName = dictDetailDefinition[strEntityName];
                EntityCollection ecDetail = service.QuickRetrieveMultiple(strEntityName, strRelatedParentFieldName, erParent.Id, $"{strEntityName}id");
                if (ecDetail != null && ecDetail.Entities.Count > 0)
                {
                    ecDetail.Entities.ToList().ForEach(etnLoop => { service.Delete(etnLoop.LogicalName, etnLoop.Id); });
                }
            }
        }

        /// <summary>
        /// 启用或停用父实体及子实体的数据
        ///     对于自定义实体，{state:0,status:1}是启用，{state:1,status:2}是停用,系统实体除外
        /// </summary>
        /// <param name="service"></param>
        /// <param name="erParent">父实体ER对象</param>
        /// <param name="dictDetailDefinition">子实体定义字典，其中字典中的Key存放子实体的实体逻辑名，Value存放子实体中关联父实体的查找字段</param>
        /// <param name="state">statecode的状态值</param>
        /// <param name="status">statuscode的状态值</param>
        public static void SetStateEntityAndDetail(this IOrganizationService service, EntityReference erParent, Dictionary<string, string> dictDetailDefinition, int state, int status)
        {
            if (!erParent.IsNotNull()) return;

            service.SetState(erParent, state, status);//启用或停用父实体记录

            foreach (string strEntityName in dictDetailDefinition.Keys)
            {
                string strRelatedParentFieldName = dictDetailDefinition[strEntityName];
                EntityCollection ecDetail = service.QuickRetrieveMultiple(strEntityName, strRelatedParentFieldName, erParent.Id, $"{strEntityName}id");
                if (ecDetail != null && ecDetail.Entities.Count > 0)
                {
                    ecDetail.Entities.ToList().ForEach(etnLoop => { service.SetState(etnLoop.ToEntityReference(), state, status); });
                }
            }
        }

        /// <summary>
        /// 分配(更改记录的负责人)
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="assignee">用户或者团队的引用</param>
        public static void Assign(this IOrganizationService service, EntityReference target, EntityReference assignee)
        {
            AssignRequest request = new AssignRequest();
            request.Target = target;
            request.Assignee = assignee;
            AssignResponse response = (AssignResponse)service.Execute(request);
        }

        /// <summary>
        /// 共享(把记录共享给用户或者团队)
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="principal">用户或者团队的引用</param>
        /// <param name="arAccessMask">需要共享的权限（如读、写、删除等）</param>
        public static void Grant(this IOrganizationService service, EntityReference target, EntityReference principal, AccessRights arAccessMask)
        {
            //权限(具体的，自己可以更改)
            PrincipalAccess principalAccess = new PrincipalAccess();
            principalAccess.AccessMask = arAccessMask;
            //共享给谁(用户或者团队)
            principalAccess.Principal = principal;
            GrantAccessRequest request = new GrantAccessRequest();
            request.PrincipalAccess = principalAccess;
            request.Target = target;
            GrantAccessResponse response = (GrantAccessResponse)service.Execute(request);
        }
        /// <summary>
        /// 共享(把记录共享给用户或者团队)
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="principal">用户或者团队的引用</param>
        public static void Grant(this IOrganizationService service, EntityReference target, EntityReference principal)
        {
            Grant(service, target, principal, AccessRights.ReadAccess | AccessRights.WriteAccess);
        }

        /// <summary>
        /// 把一条记录的共享列表复制到另一条记录上
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erSource">源记录</param>
        /// <param name="erTarget">目标记录</param>
        public static void CopySharedPrincipalAccess(this IOrganizationService service, EntityReference erSource, EntityReference erTarget)
        {
            PrincipalAccess[] principalAccesses = service.RetrieveSharedPrincipalsAndAccess(erSource);//获取源记录的共享列表
            if (principalAccesses == null || principalAccesses.Length == 0) return;

            foreach (PrincipalAccess pa in principalAccesses)
            {
                bool blnIsExistPrincipalAccessOnTarget = service.HasSharedPrincipalsAndAccess(erTarget, pa.Principal, pa.AccessMask);
                if (blnIsExistPrincipalAccessOnTarget) continue;

                service.Grant(erTarget, pa.Principal, pa.AccessMask);
            }
        }

        /// <summary>
        /// 修改共享的权限
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="principal">用户或者团队的引用</param>
        public static void Modify(this IOrganizationService service, EntityReference target, EntityReference principal)
        {
            //权限(具体的，自己可以更改)
            PrincipalAccess principalAccess = new PrincipalAccess();
            principalAccess.AccessMask = AccessRights.ReadAccess;
            //共享给谁(用户或者团队)
            principalAccess.Principal = principal;
            ModifyAccessRequest request = new ModifyAccessRequest();
            request.PrincipalAccess = principalAccess;
            request.Target = target;
            ModifyAccessResponse response = (ModifyAccessResponse)service.Execute(request);
        }

        /// <summary>
        /// 移除共享
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="revokee">用户或者团队的引用</param>
        public static void Revoke(this IOrganizationService service, EntityReference target, EntityReference revokee)
        {
            RevokeAccessRequest request = new RevokeAccessRequest();
            request.Target = target;
            request.Revokee = revokee;
            RevokeAccessResponse response = (RevokeAccessResponse)service.Execute(request);
        }

        /// <summary>
        /// 停用或者启用记录
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="state">statecode的状态值</param>
        /// <param name="status">statuscode的状态值</param>
        /// 对于自定义实体，{state:0,status:1}是启用，{state:1,status:2}是停用,系统实体除外
        public static void SetState(this IOrganizationService service, EntityReference target, int state, int status)
        {
            SetStateRequest request = new SetStateRequest();
            request.EntityMoniker = target;
            request.State = new OptionSetValue(state);
            request.Status = new OptionSetValue(status);
            service.Execute(request);
        }

        /// <summary>
        /// 查询一条记录共享给了哪些人(用户或者团队)
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <returns>权限和目标(用户或者团队)的集合</returns>
        public static PrincipalAccess[] RetrieveSharedPrincipalsAndAccess(this IOrganizationService service, EntityReference target)
        {
            RetrieveSharedPrincipalsAndAccessRequest request = new RetrieveSharedPrincipalsAndAccessRequest();
            request.Target = target;
            RetrieveSharedPrincipalsAndAccessResponse response =
                                (RetrieveSharedPrincipalsAndAccessResponse)service.Execute(request);
            return response.PrincipalAccesses;
        }

        /// <summary>
        /// 判断某条记录是否共享给了指定的用户或者团队
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="principal">权限主体(用户或者团队)</param>
        /// <param name="arAccessMask">共享的权限集合（读、写、删除、追加、分派、共享）</param>
        /// <returns></returns>
        public static bool HasSharedPrincipalsAndAccess(this IOrganizationService service, EntityReference target, EntityReference principal, AccessRights arAccessMask = AccessRights.None)
        {
            PrincipalAccess[] principalAccesses = service.RetrieveSharedPrincipalsAndAccess(target);
            if (principalAccesses == null || principalAccesses.Length == 0) return false;

            bool blnResult = false;
            if (arAccessMask == AccessRights.None) blnResult = principalAccesses.ToList().Exists(pa => pa.Principal.IsEqual(principal));
            else blnResult = principalAccesses.ToList().Exists(pa => pa.Principal.IsEqual(principal) && pa.AccessMask.HasFlag(arAccessMask));

            return blnResult;
        }

        /// <summary>
        /// 查询用户或者团队对某个记录拥有的权限
        /// </summary>
        /// <param name="service">服务</param>
        /// <param name="target">目标记录的引用</param>
        /// <param name="principal">用户或者团队的引用</param>
        /// <returns>权限</returns>
        public static AccessRights RetrievePrincipalAccess(this IOrganizationService service, EntityReference target, EntityReference principal)
        {
            RetrievePrincipalAccessRequest request = new RetrievePrincipalAccessRequest();
            request.Target = target;
            request.Principal = principal;
            RetrievePrincipalAccessResponse response = (RetrievePrincipalAccessResponse)service.Execute(request);
            return response.AccessRights;
        }

        /// <summary>
        /// 查询指定业务部门的所有下级业务部门（包含指定的业务部门）
        /// </summary>
        /// <param name="guidParentBusinessUnitId">业务部门Guid</param>
        /// <param name="orgSystemService">带有系统内置最高权限的组织服务</param>
        /// <returns>返回下级业务部门集合</returns>
        public static List<Entity> RetrieveAllChildBusinessUnits(this IOrganizationService service, Guid guidParentBusinessUnitId, params string[] columns)
        {
            RetrieveBusinessHierarchyBusinessUnitRequest request = new RetrieveBusinessHierarchyBusinessUnitRequest();
            request.ColumnSet = (columns == null || columns.Length == 0) ? new ColumnSet(true) : new ColumnSet(columns);
            request.EntityId = guidParentBusinessUnitId;
            RetrieveBusinessHierarchyBusinessUnitResponse response = (RetrieveBusinessHierarchyBusinessUnitResponse)service.Execute(request);
            if (response.EntityCollection != null && response.EntityCollection.Entities.Count > 0) return response.EntityCollection.Entities.ToList();

            return null;
        }

        /// <summary>
        /// 查询指定用户的安全角色
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="guidUserId">用户Guid</param>
        /// <returns>返回安全角色列表</returns>
        public static List<Entity> GetUserRoles(this IOrganizationService service, Guid guidUserId)
        {
            List<Entity> listResult = new List<Entity>();

            QueryExpression query = new QueryExpression("role")
            {
                ColumnSet = new ColumnSet(true),
                LinkEntities = {
                    new LinkEntity("role","systemuserroles","roleid","roleid",JoinOperator.Inner){
                        LinkCriteria=new FilterExpression(LogicalOperator.And){
                            Conditions={
                                new ConditionExpression("systemuserid",ConditionOperator.Equal,guidUserId)
                            }
                        }
                    }
                }
            };

            EntityCollection ecRole = service.RetrieveMultiple(query);
            if (ecRole != null && ecRole.Entities.Count > 0) listResult = ecRole.Entities.ToList();

            return listResult;
        }

        /// <summary>
        /// 查询指定用户的安全角色
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erUserId">用户Guid</param>
        /// <returns>返回安全角色列表</returns>
        public static List<Entity> GetUserRoles(this IOrganizationService service, EntityReference erUserId)
        {
            List<Entity> listResult = new List<Entity>();
            if (erUserId.IsNotNull()) listResult = service.GetUserRoles(erUserId.Id);

            return listResult;
        }

        /// <summary>
        /// 校验用户是否包含指定的安全角色
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="guidUserId">用户Id</param>
        /// <param name="aryRoleNames">安全角色列表</param>
        /// <returns>如果包含指定的安全角色，则返回true，反之则返回false</returns>
        public static bool HasRoles(this IOrganizationService service, Guid guidUserId, params string[] aryRoleNames)
        {
            if (aryRoleNames == null || aryRoleNames.Length == 0) return false;

            List<Entity> listRoles = service.GetUserRoles(guidUserId);
            int intCount = listRoles != null ? listRoles.Count(etn => aryRoleNames.Contains(etn.ToString("name"))) : 0;

            return intCount > 0 ? true : false;
        }

        /// <summary>
        /// 校验用户是否包含指定的安全角色
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erUserId">用户ER对象</param>
        /// <param name="aryRoleNames">安全角色列表</param>
        /// <returns>如果包含指定的安全角色，则返回true，反之则返回false</returns>
        public static bool HasRoles(this IOrganizationService service, EntityReference erUserId, params string[] aryRoleNames)
        {
            if (!erUserId.IsNotNull()) return false;

            return service.HasRoles(erUserId.Id, aryRoleNames);
        }

        /// <summary>
        /// 获取单条实体记录的审核历史记录
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erTarget">实体记录ER对象</param>
        /// <returns></returns>
        public static List<AuditDetail> RetrieveAuditHistoryForEntity(this IOrganizationService service, EntityReference erTarget)
        {
            List<AuditDetail> listResult = new List<AuditDetail>();

            RetrieveRecordChangeHistoryRequest request = new RetrieveRecordChangeHistoryRequest();
            request.Target = erTarget;
            RetrieveRecordChangeHistoryResponse response = (RetrieveRecordChangeHistoryResponse)service.Execute(request);

            if (response != null && response.AuditDetailCollection != null && response.AuditDetailCollection.AuditDetails != null)
                listResult = response.AuditDetailCollection.AuditDetails.ToList();

            return listResult;
        }

        /// <summary>
        /// 获取单条实体记录中指定字段的审核历史记录
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erTarget">实体记录ER对象</param>
        /// <param name="strAttributeLogicalName">字段逻辑名</param>
        /// <returns></returns>
        public static List<AuditDetail> RetrieveAuditHistoryForAttribute(this IOrganizationService service, EntityReference erTarget, string strAttributeLogicalName)
        {
            List<AuditDetail> listResult = new List<AuditDetail>();

            RetrieveAttributeChangeHistoryRequest request = new RetrieveAttributeChangeHistoryRequest();
            request.Target = erTarget;
            request.AttributeLogicalName = strAttributeLogicalName;
            RetrieveAttributeChangeHistoryResponse response = (RetrieveAttributeChangeHistoryResponse)service.Execute(request);

            if (response != null && response.AuditDetailCollection != null && response.AuditDetailCollection.AuditDetails != null)
                listResult = response.AuditDetailCollection.AuditDetails.ToList();

            return listResult;
        }

        /// <summary>
        /// 跳转到指定业务流程阶段
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erDataRecord">业务实体数据记录</param>
        /// <param name="strBusinessFlowEntityName"></param>
        /// <param name="strTargetStageName"></param>
        public static void NavigateToBusinessFlowStage(this IOrganizationService service, EntityReference erDataRecord, string strBusinessFlowEntityName, string strTargetStageName, bool blnIsFinishStage = false)
        {
            if (!erDataRecord.IsNotNull()) return;

            RetrieveProcessInstancesRequest requestProcessInstances = new RetrieveProcessInstancesRequest();
            requestProcessInstances.EntityLogicalName = erDataRecord.LogicalName;
            requestProcessInstances.EntityId = erDataRecord.Id;
            RetrieveProcessInstancesResponse responseProcessInstances = (RetrieveProcessInstancesResponse)service.Execute(requestProcessInstances);

            if (responseProcessInstances != null && responseProcessInstances.Processes != null && responseProcessInstances.Processes.Entities.Count > 0)
            {
                Entity etnProcessInstance = responseProcessInstances.Processes.Entities[0];

                #region 获取业务流程下的所有阶段
                RetrieveActivePathRequest requestActivePath = new RetrieveActivePathRequest();
                requestActivePath.ProcessInstanceId = etnProcessInstance.Id;
                RetrieveActivePathResponse responseActivePath = (RetrieveActivePathResponse)service.Execute(requestActivePath);
                List<Entity> listProcessStages = responseActivePath.ProcessStages.Entities.ToList();
                #endregion 获取业务流程下的所有流程阶段

                Entity etnBusinessFlowData_Exist = service.Retrieve(strBusinessFlowEntityName, etnProcessInstance.Id, new ColumnSet(true));
                EntityReference erActiveStageId = etnBusinessFlowData_Exist.ToEr("activestageid");
                string strTraversedPath_Exist = etnBusinessFlowData_Exist.ToString("traversedpath");

                int intIndex_ActiveStage = listProcessStages.FindIndex(etn => etn.ToString("stagename") == erActiveStageId.Name);
                int intIndex_TargetStage = listProcessStages.FindIndex(etn => etn.ToString("stagename") == strTargetStageName);

                #region 向前退回到指定阶段时执行
                if (intIndex_TargetStage <= intIndex_ActiveStage)
                {
                    for (int i = intIndex_TargetStage; i < listProcessStages.Count; i++)
                    {
                        Entity etnStage_Loop = listProcessStages[i];
                        strTraversedPath_Exist = strTraversedPath_Exist.Replace($"{etnStage_Loop.Id}", "");
                    }
                    strTraversedPath_Exist = strTraversedPath_Exist.TrimEnd(',');
                }
                #endregion 向前退回到指定阶段时执行

                Entity etnNextProcessStage = responseActivePath.ProcessStages.Entities.ToList().Find(etn => etn.ToString("stagename") == strTargetStageName);

                Entity etnBusinessFlowData_Update = etnBusinessFlowData_Exist.Copy();
                etnBusinessFlowData_Update.AddAttr("activestageid", etnNextProcessStage.ToEntityReference());
                etnBusinessFlowData_Update.AddAttr("traversedpath", strTraversedPath_Exist + "," + etnNextProcessStage.Id.ToString());
                service.Update(etnBusinessFlowData_Update);

                if (blnIsFinishStage) service.SetState(etnBusinessFlowData_Update.ToEntityReference(), 1, 2);//完成阶段
            }
        }

        #region Action
        /// <summary>
        /// 根据Word模板下载文件到【注释】中
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="erSelectedTemplate">Word模板ER</param>
        /// <param name="erTarget">业务实体记录ER</param>
        /// <returns>返回创建的包含附件的注释Entity</returns>
        public static Entity DownloadByWordTemplate(this IOrganizationService service, EntityReference erSelectedTemplate, EntityReference erTarget)
        {
            Entity etnAnnotation = new Entity();

            #region 根据指定的word模板下载文件，并生成【注释】
            OrganizationRequest request = new OrganizationRequest("SetWordTemplate");
            request["SelectedTemplate"] = erSelectedTemplate;
            request["Target"] = erTarget;
            service.Execute(request);
            #endregion 根据指定的word模板下载文件，并生成【注释】

            #region 返回上面生成的【注释】记录
            QueryExpression queryAnnotation = new QueryExpression("annotation")
            {
                ColumnSet = new ColumnSet("documentbody", "filename", "filesize", "isdocument", "langid", "mimetype", "notetext", "objectid", "ownerid", "stepid", "subject"),
                Criteria = new FilterExpression(LogicalOperator.And)
                {
                    Conditions = {
                        new ConditionExpression("objectid",ConditionOperator.Equal,erTarget.Id),
                        new ConditionExpression("isdocument",ConditionOperator.Equal,true)
                    }
                },
                TopCount = 1,
                Orders = {
                    new OrderExpression("createdon",OrderType.Descending)
                }
            };
            EntityCollection ecAnnotation = service.RetrieveMultiple(queryAnnotation);
            if (ecAnnotation != null && ecAnnotation.Entities.Count > 0) etnAnnotation = ecAnnotation.Entities[0];
            #endregion 返回上面生成的【注释】记录

            return etnAnnotation;
        }
        #endregion Action

        #region Metadata

        /// <summary>
        /// 根据实体逻辑名查找实体元数据信息
        /// </summary>
        /// <param name="service">CRM组织服务</param>
        /// <param name="strEntityName">实体逻辑名</param>
        /// <param name="filters">元数据筛选器</param>
        /// <returns>返回实体元数据信息</returns>
        public static EntityMetadata RetrieveEntityMetadata(this IOrganizationService service, string strEntityName,EntityFilters filters=EntityFilters.Entity)
        {
            RetrieveEntityRequest request = new RetrieveEntityRequest();
            request.LogicalName = strEntityName;
            request.RetrieveAsIfPublished = true;
            request.EntityFilters = filters;
            RetrieveEntityResponse response = (RetrieveEntityResponse)service.Execute(request);
            return response.EntityMetadata;
        }

        /// <summary>
        /// 根据实体逻辑名和字段逻辑名查找字段元数据信息
        /// </summary>
        /// <param name="service">CRM组织服务</param>
        /// <param name="strEntityName">实体逻辑名</param>
        /// <param name="strFieldName">字段逻辑名</param>
        /// <returns>返回实体字段元数据信息</returns>
        public static AttributeMetadata RetrieveAttributeMetadata(this IOrganizationService service, string strEntityName, string strFieldName, bool blnRetrieveAsIfPublished = true)
        {
            AttributeMetadata amResult = null;
            RetrieveAttributeRequest request = new RetrieveAttributeRequest()
            {
                EntityLogicalName = strEntityName,
                LogicalName = strFieldName,
                RetrieveAsIfPublished = blnRetrieveAsIfPublished
            };

            try
            {
                RetrieveAttributeResponse response = (RetrieveAttributeResponse)service.Execute(request);
                if (response != null && response.AttributeMetadata != null) amResult = response.AttributeMetadata;
            }
            catch (Exception ex) { throw ex; }
            return amResult;
        }

        /// <summary>
        /// 校验实体元数据中是否存在指定字段
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="strEntityName">实体逻辑名</param>
        /// <param name="strFieldName">字段逻辑名</param>
        /// <returns></returns>
        public static bool IsEntityHasField(this IOrganizationService service, string strEntityName, string strFieldName)
        {
            AttributeMetadata am = service.RetrieveAttributeMetadata(strEntityName, strFieldName);
            if (am != null) return true;

            return false;
        }

        /// <summary>
        /// 创建Lookup字段
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="metadata">Lookup字段元数据</param>
        /// <param name="strMainEntityName">主要实体名</param>
        /// <param name="strRelatedEntityName">相关实体名</param>
        public static void CreateLookupAttributeMetadata(this IOrganizationService service, LookupAttributeMetadata metadata, string strMainEntityName, string strRelatedEntityName)
        {
            string strPrefix = metadata.SchemaName.Substring(0, metadata.SchemaName.IndexOf("_"));

            string strSchemaName = string.Empty;
            if (strMainEntityName.StartsWith(strPrefix)) strSchemaName = $"{strMainEntityName}_{strRelatedEntityName}";
            else strSchemaName = $"{strPrefix}_{strMainEntityName}_{strRelatedEntityName}";
            CreateOneToManyRequest request = new CreateOneToManyRequest()
            {
                Lookup = metadata,
                OneToManyRelationship = new OneToManyRelationshipMetadata()
                {
                    ReferencedEntity = strMainEntityName,
                    ReferencingEntity = strRelatedEntityName,
                    SchemaName = strSchemaName,
                    AssociatedMenuConfiguration = new AssociatedMenuConfiguration
                    {
                        Behavior = AssociatedMenuBehavior.UseCollectionName,
                        Group = AssociatedMenuGroup.Details,
                        Order = 10000
                    },
                    CascadeConfiguration = new CascadeConfiguration
                    {
                        Assign = CascadeType.NoCascade,
                        Delete = CascadeType.RemoveLink,
                        Merge = CascadeType.NoCascade,
                        Reparent = CascadeType.NoCascade,
                        Share = CascadeType.NoCascade,
                        Unshare = CascadeType.NoCascade
                    }
                }
            };
            service.Execute(request);
        }

        /// <summary>
        /// 删除指定实体中的字段
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="strEntityName">实体逻辑名</param>
        /// <param name="attributeMetadatas">字段元数据数组</param>
        public static void DeleteAttributeMetadata(this IOrganizationService service, string strEntityName, params AttributeMetadata[] attributeMetadatas)
        {
            if (attributeMetadatas == null || attributeMetadatas.Length == 0) return;

            foreach (AttributeMetadata metadata in attributeMetadatas)
            {
                if (string.IsNullOrEmpty(metadata.EntityLogicalName) || string.IsNullOrEmpty(metadata.LogicalName)) continue;
                DeleteAttributeRequest request = new DeleteAttributeRequest()
                {
                    EntityLogicalName = strEntityName,
                    LogicalName = metadata.LogicalName
                };
                service.AddToMultiRequestList(request);
            }
            service.ExecuteTransaction();
        }

        /// <summary>
        /// 发布实体
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="aryEntityName">实体名数组</param>
        public static void PublishEntities(this IOrganizationService service, params string[] aryEntityName)
        {
            if (aryEntityName == null || aryEntityName.Length == 0) return;

            string strEntityElements = string.Empty;
            foreach (string strEntityName in aryEntityName)
            {
                if (string.IsNullOrEmpty(strEntityName) && string.IsNullOrEmpty(strEntityName.Trim())) continue;
                strEntityElements += "<xs:element maxOccurs='unbounded' type='xs:string' name='" + strEntityName + "'/>";
            }
            if (string.IsNullOrEmpty(strEntityElements)) return;

            string strPublishXml = "<xs:schema attributeFormDefault='unqualified' elementFormDefault='qualified' xmlns:xs='http://www.w3.org/2001/XMLSchema'>"
                                   + "    <xs:element name='importexportxml'>"
                                   + "    <xs:complexType>"
                                   + "    <xs:sequence>"
                                   + "    <xs:element name='entities'"
                                   + "                minOccurs='0'>"
                                   + "        <xs:complexType>"
                                   + "        <xs:sequence minOccurs='0'"
                                   + "                    maxOccurs='unbounded'>"
                                   + "        <!-- Name of the entity to publish-->"
                                   + strEntityElements
                                   + "        </xs:sequence>"
                                   + "        </xs:complexType>"
                                   + "    </xs:element>"
                                   + "    </xs:sequence>"
                                   + "    </xs:complexType>"
                                   + "    </xs:element>"
                                   + "</xs:schema>";
            service.Execute(new PublishXmlRequest() { ParameterXml = strPublishXml });
        }
        #endregion Metadata

        #region Execute Multiple

        private static List<OrganizationRequest> listMultiRequest = new List<OrganizationRequest>();
        /// <summary>
        /// 将请求添加到集合中
        /// </summary>
        /// <param name="request"></param>
        public static void AddToMultiRequestList(this IOrganizationService service, OrganizationRequest request)
        {
            listMultiRequest.Add(request);
        }

        /// <summary>
        /// 在事务中执行批量请求
        /// </summary>
        /// <param name="service"></param>
        public static void ExecuteTransaction(this IOrganizationService service)
        {
            if (listMultiRequest == null || listMultiRequest.Count == 0) return;

            ExecuteTransactionRequest tranRequest = new ExecuteTransactionRequest();
            tranRequest.Requests = new OrganizationRequestCollection();
            for (int i = 0; i < listMultiRequest.Count; i += 1000)
            {
                int intLoopListCount = listMultiRequest.Count >= 1000 ? 1000 : listMultiRequest.Count;
                tranRequest.Requests.AddRange(listMultiRequest.GetRange(0, intLoopListCount));
                listMultiRequest.RemoveRange(0, intLoopListCount);

                service.Execute(tranRequest);
                tranRequest.Requests.Clear();
            }
        }

        #endregion Execute Multiple


        #region 根据多选选项集值获取Label
        /// <summary>
        /// 根据多选选项集值获取Label
        /// </summary>
        /// <param name="service"></param>
        /// <param name="entityname"></param>
        /// <param name="attributename"></param>
        /// <param name="value"></param>
        /// <returns></returns>
        public static string GetMultiOptionLabel(this IOrganizationService service, string entityname, string attributename, int value)
        {
            RetrieveAttributeRequest retrieveAttributeRequest =
                new RetrieveAttributeRequest
                {
                    EntityLogicalName = entityname,
                    LogicalName = attributename
                };
            // Execute the request. 
            RetrieveAttributeResponse retrieveAttributeResponse = (RetrieveAttributeResponse)service.Execute(retrieveAttributeRequest);
            OptionMetadataCollection options = ((MultiSelectPicklistAttributeMetadata)retrieveAttributeResponse.AttributeMetadata).OptionSet.Options;
            OptionMetadata option = options.Where(x => x.Value == value).FirstOrDefault();
            if (option != null)
            {
                return option.Label.UserLocalizedLabel.Label;
            }
            else
            {
                return "";
            }
        }
        #endregion
    }
}
